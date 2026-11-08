/**
 * 服务端集成测试：直接调用 route handler（不启动 Next 服务器）。
 *
 * 为什么这样测：本会话沙箱禁止 spawn，`next dev` / `next build` 都会 EPERM，
 * 但 API 逻辑本身可以进程内验证 —— 这比"跑起来了但我没点过"更有说服力。
 * 覆盖：两段式生成（outline JSON + deck SSE）、草稿 CRUD、连通性检测。
 */
import { describe, expect, it, beforeAll } from "./harness";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = path.resolve("data/test-app.db");
process.env.DATABASE_PATH = TEST_DB;
process.env.LLM_PROVIDER = "mock";
delete process.env.LLM_API_KEY;

if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;

let generatePOST: Handler;
let decksGET: () => Promise<Response>;
let deckIdGET: Handler;
let deckIdPUT: Handler;
let connectivityGET: () => Promise<Response>;

beforeAll(async () => {
  ({ POST: generatePOST } = (await import("../src/app/api/generate/route.ts")) as unknown as {
    POST: Handler;
  });
  const decks = (await import("../src/app/api/decks/route.ts")) as unknown as {
    GET: () => Promise<Response>;
  };
  decksGET = decks.GET;
  const one = (await import("../src/app/api/decks/[id]/route.ts")) as unknown as {
    GET: Handler;
    PUT: Handler;
  };
  deckIdGET = one.GET;
  deckIdPUT = one.PUT;
  connectivityGET = (
    (await import("../src/app/api/connectivity/route.ts")) as unknown as {
      GET: () => Promise<Response>;
    }
  ).GET;
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API · 两段式生成", () => {
  it("第一段只出大纲，返回可编辑的 title/role 列表", async () => {
    const res = await generatePOST(
      jsonReq({ stage: "outline", topic: "2026 年 Q3 业务复盘", slideCount: 10 })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { outline: { title: string; role: string }[]; mock: boolean };
    expect(data.outline.length).toBeGreaterThanOrEqual(8);
    expect(data.mock).toBe(true);
    expect(typeof data.outline[0].title).toBe("string");
  });

  it("缺 topic 时返回 400，而不是静默生成", async () => {
    const res = await generatePOST(jsonReq({ stage: "outline" }));
    expect(res.status).toBe(400);
  });

  it("第二段走 SSE，事件含 step/slide/done，且草稿已入库", async () => {
    const res = await generatePOST(
      jsonReq({ stage: "deck", topic: "测试主题：季度复盘", slideCount: 8 })
    );
    expect(res.headers.get("content-type")?.includes("text/event-stream")).toBe(true);
    const text = await res.text();
    expect(text.includes('"type":"step"')).toBe(true);
    expect(text.includes('"type":"slide"')).toBe(true);
    expect(text.includes('"type":"done"')).toBe(true);
    expect(text.includes('"type":"saved"')).toBe(true);
    // done 里带的 deck 必须能过 IR 校验（这里只检查页数字段存在）
    expect(text.includes('"slides"')).toBe(true);
  });
});

describe("API · 草稿 CRUD", () => {
  it("生成后能在列表里查到，并能按 id 读回、改存", async () => {
    const listRes = await decksGET();
    const list = (await listRes.json()) as { decks: { id: string; slideCount: number }[] };
    expect(list.decks.length).toBeGreaterThan(0);

    const id = list.decks[0].id;
    const getRes = await deckIdGET(new Request(`http://localhost/api/decks/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(getRes.status).toBe(200);
    const { deck } = (await getRes.json()) as { deck: { meta: { title: string }; slides: unknown[] } };
    expect(deck.slides.length).toBeGreaterThan(0);

    deck.meta.title = "改过标题";
    const putRes = await deckIdPUT(
      new Request(`http://localhost/api/decks/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck }),
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(putRes.status).toBe(200);
    const saved = (await putRes.json()) as { savedAt: string };
    expect(typeof saved.savedAt).toBe("string");

    const again = await deckIdGET(new Request(`http://localhost/api/decks/${id}`), {
      params: Promise.resolve({ id }),
    });
    const after = (await again.json()) as { deck: { meta: { title: string } } };
    expect(after.deck.meta.title).toBe("改过标题");
  });

  it("读不存在的草稿返回 404", async () => {
    const res = await deckIdGET(new Request("http://localhost/api/decks/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("写入不合法的 deck 时返回 400（不静默写库）", async () => {
    const res = await deckIdPUT(
      new Request("http://localhost/api/decks/x", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck: { schemaVersion: "1.0" } }),
      }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("API · 连通性", () => {
  it("无 Key 时报告 mock 模式，且不泄露 key 字段", async () => {
    const res = await connectivityGET();
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(cfg.mock).toBe(true);
    expect(cfg.hasKey).toBe(false);
    // 绝不能出现 key 本体
    expect(JSON.stringify(cfg).includes("apiKey")).toBe(false);
  });
});
