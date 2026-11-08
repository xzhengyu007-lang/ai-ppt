/** 单份草稿：读 / 存 / 删 */
import type { NextRequest } from "next/server";
import { deckSchema } from "@/lib/ir/schema";
import { deleteDeck, getDeck, saveDeck } from "@/lib/storage/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const deck = getDeck(id);
  if (!deck) return Response.json({ error: "草稿不存在" }, { status: 404 });
  return Response.json({ id, deck });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { deck?: unknown };
  const parsed = deckSchema.safeParse(body.deck);
  if (!parsed.success) {
    return Response.json(
      { error: "deck 未通过 IR 校验", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const deck = { ...parsed.data, meta: { ...parsed.data.meta, updatedAt: new Date().toISOString() } };
  saveDeck(deck, id);
  return Response.json({ id, savedAt: deck.meta.updatedAt });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteDeck(id);
  return Response.json({ ok: true });
}
