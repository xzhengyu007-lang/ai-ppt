/**
 * 草稿存储 —— SQLite，零原生依赖。
 *
 * 技术选型偏离说明（诚实记录）：
 *   任务书默认 "SQLite + Drizzle"。这里改用 Node 24 内置的 `node:sqlite`
 *   + 手写 SQL，原因是 `better-sqlite3` 是原生模块，本机（Node 24 / Windows）
 *   没有预编译产物，安装要走 MSVC 编译；而仓库还有"CI 不依赖外网/构建工具链"
 *   的硬要求。内置模块零安装、零原生依赖，API 面很小，维护成本更低。
 *   所有 SQL 都收在本文件里，将来要换 Drizzle 只改这一层。
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Deck } from "@/lib/ir/schema";

export interface DeckRecord {
  id: string;
  title: string;
  themeId: string;
  templateId: string;
  slideCount: number;
  /** 完整 IR（JSON 字符串存库） */
  deckJson: string;
  createdAt: string;
  updatedAt: string;
}

const DB_PATH = process.env.DATABASE_PATH ?? "./data/app.db";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const abs = path.resolve(DB_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  db = new DatabaseSync(abs);
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      slide_count INTEGER NOT NULL,
      deck_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decks_updated ON decks(updated_at DESC);
  `);
  return db;
}

export function newId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveDeck(deck: Deck, id?: string): string {
  const d = getDb();
  const deckId = id ?? newId();
  const nowIso = new Date().toISOString();
  const existing = d.prepare("SELECT id FROM decks WHERE id = ?").get(deckId);

  if (existing) {
    d.prepare(
      `UPDATE decks SET title=?, theme_id=?, template_id=?, slide_count=?, deck_json=?, updated_at=? WHERE id=?`
    ).run(
      deck.meta.title,
      deck.meta.themeId,
      deck.meta.templateId,
      deck.slides.length,
      JSON.stringify(deck),
      nowIso,
      deckId
    );
  } else {
    d.prepare(
      `INSERT INTO decks (id,title,theme_id,template_id,slide_count,deck_json,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      deckId,
      deck.meta.title,
      deck.meta.themeId,
      deck.meta.templateId,
      deck.slides.length,
      JSON.stringify(deck),
      nowIso,
      nowIso
    );
  }
  return deckId;
}

export function getDeck(id: string): Deck | null {
  const row = getDb().prepare("SELECT deck_json FROM decks WHERE id = ?").get(id) as
    | { deck_json: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.deck_json) as Deck;
}

export function listDecks(limit = 20): Omit<DeckRecord, "deckJson">[] {
  const rows = getDb()
    .prepare(
      `SELECT id,title,theme_id,template_id,slide_count,created_at,updated_at
       FROM decks ORDER BY updated_at DESC LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    title: string;
    theme_id: string;
    template_id: string;
    slide_count: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    themeId: r.theme_id,
    templateId: r.template_id,
    slideCount: r.slide_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function deleteDeck(id: string): void {
  getDb().prepare("DELETE FROM decks WHERE id = ?").run(id);
}
