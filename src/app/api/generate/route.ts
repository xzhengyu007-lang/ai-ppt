/**
 * 生成接口 —— 服务端只做两件事：LLM 代理 + 存储。
 * 前端永远只调本站接口，**Key 不出服务端**。
 *
 * 两段式：
 *   POST /api/generate  { stage: "outline" } → 返回大纲（JSON，用户可改）
 *   POST /api/generate  { stage: "deck" }    → SSE 流式返回进度与成品
 */
import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/llm/pipeline";
import { publicConfig } from "@/lib/llm/provider";
import { saveDeck } from "@/lib/storage/decks";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";
import { deckSchema } from "@/lib/ir/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  stage?: "outline" | "deck";
  topic?: string;
  themeId?: string;
  slideCount?: number;
  outline?: { title: string; role: string; point?: string }[];
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) return Response.json({ error: "缺少 topic" }, { status: 400 });

  // ---- 第一段：只出大纲 ----
  if (body.stage === "outline") {
    const cfg = publicConfig();
    if (cfg.mock) {
      const deck = buildMockDeck({
        topic,
        themeId: body.themeId,
        slideCount: body.slideCount,
      });
      return Response.json({
        mock: true,
        brief: {
          audience: "管理层",
          scenario: "季度复盘",
          durationMin: 20,
          slideCount: deck.slides.length,
          language: "zh-CN",
          style: "结论先行",
          coreMessage: topic,
        },
        outline: deck.slides.map((s) => ({
          title: s.slots.title?.kind === "text" ? s.slots.title.text : topic,
          role: s.layout,
          point: s.notes.slice(0, 60),
        })),
      });
    }
    // 真模型：跑一次 brief + outline（复用 pipeline 的第一段）
    const deck = await runPipeline({
      topic,
      themeId: body.themeId,
      slideCount: body.slideCount,
      // 用一个不可能命中的 outline 触发内部生成路径
    });
    return Response.json({
      mock: false,
      outline: deck.slides.map((s) => ({
        title: s.slots.title?.kind === "text" ? s.slots.title.text : topic,
        role: s.layout,
        point: "",
      })),
    });
  }

  // ---- 第二段：逐页生成（SSE）----
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const deck = await runPipeline({
          topic,
          themeId: body.themeId,
          slideCount: body.slideCount,
          outline: body.outline as never,
          onProgress: send,
        });
        // 存库前再过一次 schema，防止把坏数据写进草稿
        const checked = deckSchema.safeParse(deck);
        if (!checked.success) {
          send({
            type: "error",
            message: `生成的 deck 未通过 IR 校验：${checked.error.issues
              .map((i) => i.path.join("."))
              .join(",")}`,
          });
        } else {
          const id = saveDeck(checked.data);
          send({ type: "saved", id });
        }
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
