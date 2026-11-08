import { describe, expect, it } from "./harness";
import { LAYOUT_IDS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/ir/constants";
import { LAYOUTS } from "@/lib/layout/definitions";
import { resolveDeck, resolveSlide, assertNoHorizontalOverflow } from "@/lib/layout/resolve";
import { buildLayoutCoverageDeck, buildMockDeck } from "@/lib/fixtures/mock-deck";
import { THEMES } from "@/lib/theme/themes";
import { deckSchema } from "@/lib/ir/schema";

describe("版式定义自洽性", () => {
  it("8 种版式全部存在，且槽位 id 唯一", () => {
    expect(LAYOUT_IDS.length).toBe(8);
    for (const id of LAYOUT_IDS) {
      const def = LAYOUTS[id];
      expect(def).toBeTruthy();
      const ids = def.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(def.slots.length).toBeGreaterThan(0);
    }
  });

  it("所有槽位都在画布内", () => {
    for (const id of LAYOUT_IDS) {
      for (const s of LAYOUTS[id].slots) {
        expect(s.box.x).toBeGreaterThanOrEqual(0);
        expect(s.box.y).toBeGreaterThanOrEqual(0);
        expect(s.box.x + s.box.w).toBeLessThanOrEqual(CANVAS_WIDTH);
        expect(s.box.y + s.box.h).toBeLessThanOrEqual(CANVAS_HEIGHT);
      }
    }
  });

  it("装饰元素也在画布内", () => {
    for (const id of LAYOUT_IDS) {
      for (const d of LAYOUTS[id].decor ?? []) {
        expect(d.box.x + d.box.w).toBeLessThanOrEqual(CANVAS_WIDTH);
        expect(d.box.y + d.box.h).toBeLessThanOrEqual(CANVAS_HEIGHT);
      }
    }
  });
});

describe("主题注册表", () => {
  it("恰好 12 套主题，id 唯一", () => {
    expect(THEMES.length).toBe(12);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(12);
  });

  it("每套主题的 token 都通过 IR schema", () => {
    for (const t of THEMES) {
      const deck = {
        schemaVersion: "1.0" as const,
        meta: {
          title: "t",
          size: "16:9" as const,
          templateId: t.id,
          themeId: t.id,
          locale: "zh-CN" as const,
          createdAt: "",
          updatedAt: "",
        },
        theme: t.tokens,
        slides: [
          {
            id: "a",
            layout: "cover" as const,
            slots: { title: { kind: "text" as const, text: "x" } },
            notes: "",
            warnings: [],
          },
        ],
      };
      expect(() => deckSchema.parse(deck)).not.toThrow();
    }
  });
});

describe("12 套主题 × 8 版式 = 96 个实例全部可渲染", () => {
  it("每个组合都能解析出元素，且不越界", () => {
    let combos = 0;
    for (const theme of THEMES) {
      const deck = buildLayoutCoverageDeck(theme.id);
      const resolved = resolveDeck(deck);
      expect(resolved.length).toBe(8);
      for (const rs of resolved) {
        combos++;
        expect(rs.elements.length).toBeGreaterThan(0);
        const bad = assertNoHorizontalOverflow(rs.elements);
        expect(bad, `${theme.id}/${rs.layout}: ${bad.join(",")}`).toEqual([]);
        // 每页必须有可见文本（不允许空页）
        const hasText = rs.elements.some((e) => e.kind === "text" || e.kind === "bullets");
        expect(hasText, `${theme.id}/${rs.layout} 没有文字`).toBe(true);
      }
    }
    expect(combos).toBe(96);
  });
});

describe("mock deck 质量门", () => {
  it("10 页、通过 schema、每页备注 ≥80 字、无溢出警告", () => {
    const deck = buildMockDeck({ topic: "2026 年 Q3 业务复盘" });
    expect(() => deckSchema.parse(deck)).not.toThrow();
    expect(deck.slides.length).toBe(10);

    for (const s of deck.slides) {
      expect(s.notes.length).toBeGreaterThanOrEqual(80);
    }

    const resolved = resolveDeck(deck);
    for (const rs of resolved) {
      const overflow = rs.warnings.filter((w) => w.includes("溢出"));
      expect(overflow, `${rs.id}: ${overflow.join("|")}`).toEqual([]);
      const outOfBounds = assertNoHorizontalOverflow(rs.elements);
      expect(outOfBounds).toEqual([]);
    }
  });

  it("覆盖了全部 8 种版式（mock 模式本身就是版式回归）", () => {
    const deck = buildMockDeck();
    const used = new Set(deck.slides.map((s) => s.layout));
    for (const id of LAYOUT_IDS) {
      expect(used.has(id), `mock deck 缺少版式 ${id}`).toBe(true);
    }
  });
});

describe("内容契约：超字数要打标记，不静默", () => {
  it("超出 maxChars 的标题产生 warning", () => {
    const deck = buildMockDeck();
    // 封面标题预算 42 字，这里给 60 字，必须触发
    const longTitle =
      "这是一个被刻意写得非常长的标题用来触发字数预算检查的边界情况并且还要继续加长直到确实超过限制";
    expect([...longTitle].length).toBeGreaterThan(42);
    const slide = {
      ...deck.slides[0],
      slots: { ...deck.slides[0].slots, title: { kind: "text" as const, text: longTitle } },
    };
    const rs = resolveSlide(deck, slide);
    expect(rs.warnings.some((w) => w.includes("字数预算"))).toBe(true);
  });

  it("图表数据不一致要报 warning", () => {
    const deck = buildMockDeck();
    const dataSlide = deck.slides.find((s) => s.layout === "data" && s.slots.chart)!;
    const broken = {
      ...dataSlide,
      slots: {
        ...dataSlide.slots,
        chart: {
          kind: "chart" as const,
          chart: { type: "bar" as const, categories: ["A", "B"], series: [{ name: "s", values: [1] }] },
        },
      },
    };
    const rs = resolveSlide(deck, broken);
    expect(rs.warnings.some((w) => w.includes("图表数据不一致"))).toBe(true);
  });
});
