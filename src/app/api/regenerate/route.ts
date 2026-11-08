/** 单页重生成：复用同一条五步流水线，只是把大纲砍到一页 */
import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/llm/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    topic?: string;
    themeId?: string;
    outline?: { title: string; role: string; point?: string }[];
  };

  const topic = body.topic?.trim();
  const item = body.outline?.[0];
  if (!topic || !item) {
    return Response.json({ error: "缺少 topic 或 outline" }, { status: 400 });
  }

  try {
    const deck = await runPipeline({
      topic,
      themeId: body.themeId,
      slideCount: 1,
      outline: [item as never],
    });
    const slide = deck.slides[0];
    if (!slide) return Response.json({ error: "流水线没有产出页面" }, { status: 500 });
    return Response.json({ slide, theme: deck.theme });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
