/**
 * 构图语言（composition）—— 让 12 套模板不只是"换颜色"。
 *
 * 这是本轮返工的核心：之前 12 套主题共用**同一套几何**，所以看起来像一个模板换了 12 个色。
 * presenton（Apache-2.0）的做法是每套模板自带构图与装饰元素，我们照这个思路抽象出 4 种构图：
 *
 *   standard   基线：标题左上、正文跟随（原来的样子）
 *   editorial  杂志/学术：大留白 + 发丝竖线 + 超大章节号，标本用宋体
 *   card       SaaS/科技：内容装进圆角卡片，底色分层
 *   band       政务/金融/发布：整块色带压边，标题压在色带上
 *   rail       现代企业：左侧通高色条，内容整体右移
 *
 * 所有几何仍然在 1280×720 画布内，并受 tests/layout.test.ts 的越界断言保护。
 */
import type { ReactNode } from "react";
import type { ThemeTokens } from "@/lib/ir/schema";
import type { Box, DecorDef, LayoutDef, SlotDef } from "./definitions";

export type CompositionId = "standard" | "editorial" | "card" | "band" | "rail";

export const COMPOSITION_LABELS: Record<CompositionId, string> = {
  standard: "基线",
  editorial: "编辑排版",
  card: "卡片",
  band: "色带",
  rail: "竖栏",
};

const RIGHT = 1200; // 右安全边

function shift(slot: SlotDef, dx: number, dy: number): SlotDef {
  return { ...slot, box: { ...slot.box, x: slot.box.x + dx, y: slot.box.y + dy } };
}

function withBox(slot: SlotDef, box: Partial<Box>): SlotDef {
  return { ...slot, box: { ...slot.box, ...box } };
}

function pick(layout: LayoutDef, id: string): SlotDef | undefined {
  return layout.slots.find((s) => s.id === id);
}

function replace(layout: LayoutDef, id: string, next: SlotDef): LayoutDef {
  return {
    ...layout,
    slots: layout.slots.map((s) => (s.id === id ? next : s)),
  };
}

/** 给版式追加或覆盖装饰元素（装饰先绘制，位于文字下层） */
function decor(layout: LayoutDef, extra: DecorDef[]): LayoutDef {
  return { ...layout, decor: [...(layout.decor ?? []), ...extra] };
}

/**
 * 按构图改写一个版式。纯函数，不依赖外部状态，便于单测。
 */
export function composeLayout(
  layout: LayoutDef,
  composition: CompositionId,
  theme: ThemeTokens
): LayoutDef {
  if (composition === "standard") return layout;

  let out = layout;
  const title = pick(layout, "title");
  const body = pick(layout, "body");

  switch (composition) {
    /* ------------------------------------------------ 编辑排版 */
    case "editorial": {
      // 标题下移、字号放大；左侧加发丝竖线；右上角大号页序
      if (title) {
        out = replace(
          out,
          "title",
          withBox({ ...title, fontSize: Math.round(title.fontSize * 1.1) }, { y: title.box.y + 18 })
        );
      }
      if (body && title) {
        out = replace(out, "body", withBox(body, { y: body.box.y + 26, w: body.box.w - 40 }));
      }
      out = decor(out, [
        { kind: "rule", box: { x: 48, y: 120, w: 3, h: 420 }, colorKey: "accent" },
        { kind: "rule", box: { x: 80, y: 96, w: 120, h: 1 }, colorKey: "border" },
        // 页眉处一个小实心方块，给竖线一个"起点"，避免线条悬空
        { kind: "block", box: { x: 48, y: 100, w: 20, h: 20 }, colorKey: "accent" },
      ]);
      break;
    }

    /* ---------------------------------------------------- 卡片 */
    case "card": {
      // 标题与正文各自装进一张圆角卡片：先铺卡底（decor），再把文字内缩
      if (title) {
        out = decor(out, [
          {
            kind: "block",
            box: { x: title.box.x - 28, y: title.box.y - 18, w: title.box.w + 56, h: title.box.h + 30 },
            colorKey: "surface",
            radius: 16,
          },
        ]);
        out = replace(out, "title", shift(title, 4, 6));
      }
      if (body) {
        out = decor(out, [
          {
            kind: "block",
            box: { x: body.box.x - 28, y: body.box.y - 16, w: body.box.w + 56, h: body.box.h + 34 },
            colorKey: "surface",
            radius: 16,
          },
        ]);
        out = replace(out, "body", shift(body, 4, 8));
      }
      break;
    }

    /* -------------------------------------------------- 色带 */
    case "band": {
      const bandTop = 96;
      const bandH = 176;
      out = decor(out, [
        { kind: "block", box: { x: 0, y: bandTop, w: 1280, h: bandH }, colorKey: "sectionBg" },
        // 色带下沿压一条强调色发丝线：把"一整块色"收出边界，避免糊成一片
        { kind: "rule", box: { x: 0, y: bandTop + bandH, w: 1280, h: 4 }, colorKey: "accent" },
      ]);
      if (title) {
        out = replace(
          out,
          "title",
          withBox({ ...title, colorKey: "onSection" }, { x: 80, y: bandTop + 52, w: 1120 })
        );
      }
      if (body) {
        out = replace(out, "body", withBox(body, { y: bandTop + bandH + 44, h: 720 - (bandTop + bandH) - 96 }));
      }
      break;
    }

    /* -------------------------------------------------- 竖栏 */
    case "rail": {
      out = decor(out, [
        { kind: "block", box: { x: 0, y: 0, w: 14, h: 720 }, colorKey: "accent" },
        { kind: "block", box: { x: 14, y: 0, w: 3, h: 720 }, colorKey: "primary" },
        // 竖栏右下方留一个短刻度，呼应左侧色条又不抢视线
        { kind: "bar", box: { x: 48, y: 664, w: 40, h: 4 }, colorKey: "accent", radius: 2 },
      ]);
      if (title) out = replace(out, "title", shift(title, 34, 0));
      if (body) out = replace(out, "body", shift(body, 34, 0));
      for (const id of ["subtitle", "eyebrow", "footer", "caption", "insight"]) {
        const s = pick(out, id);
        if (s) out = replace(out, id, shift(s, 34, 0));
      }
      break;
    }
  }

  // 所有构图都保证槽位不出界（测试也会兜底）
  out = {
    ...out,
    slots: out.slots.map((s) => ({
      ...s,
      box: {
        x: Math.max(0, Math.min(s.box.x, RIGHT - s.box.w)),
        y: Math.max(0, Math.min(s.box.y, 720 - s.box.h)),
        w: Math.min(s.box.w, RIGHT - Math.max(0, s.box.x)),
        h: Math.min(s.box.h, 720 - Math.max(0, s.box.y)),
      },
    })),
  };

  return out;
}

/** 预留：以后要给构图加"同构图不同密度"时用得上 */
export type CompositionRenderer = (args: {
  layout: LayoutDef;
  theme: ThemeTokens;
}) => ReactNode;
