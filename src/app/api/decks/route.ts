/** 草稿列表 / 新建 */
import type { NextRequest } from "next/server";
import { deckSchema } from "@/lib/ir/schema";
import { listDecks, saveDeck } from "@/lib/storage/decks";
import { buildMockDeck } from "@/lib/fixtures/mock-deck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ decks: listDecks(30) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { deck?: unknown; topic?: string; themeId?: string };
  const candidate = body.deck ?? buildMockDeck({ topic: body.topic, themeId: body.themeId });
  const parsed = deckSchema.safeParse(candidate);
  if (!parsed.success) {
    return Response.json(
      { error: "deck 未通过 IR 校验", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const id = saveDeck(parsed.data);
  return Response.json({ id });
}
