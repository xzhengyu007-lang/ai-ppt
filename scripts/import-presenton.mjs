/**
 * 从 presenton（Apache-2.0）导入模板的**配色与字体决策**，生成我们自己的主题 token。
 *
 * 导入的边界（重要，写进 docs/03-素材来源.csv）：
 *   ✅ 导入：theme.colors 的取值、字体搭配倾向（衬线/无衬线/超粗）
 *   ❌ 不导入：它的绝对定位元素树（merged_components / layouts）——与我们的「槽位+内容」模型不同构
 *
 * 字体处理：presenton 用 Playfair/Poppins/Montserrat 等 Google 字体，中文场景不能用；
 * 这里按"性格"映射到我们的白名单（宋体=衬线、微软雅黑=中性、等线=轻量）。
 *
 * 用法：node scripts/import-presenton.mjs
 */
import fs from "node:fs";
import path from "node:path";

const IDS = [
  "editorial",
  "nova",
  "mosaic",
  "pulse",
  "civic",
  "executive",
  "landmark",
  "momentum",
  "horizon",
  "signal",
  "modern",
  "general",
  "dynamic",
  "standard",
];

const BASE = "https://raw.githubusercontent.com/presenton/presenton/HEAD/templates";

/* ---------------------------------------------------------------- 颜色工具 */

const hex = (h) => h.replace(/^#/, "").toUpperCase();
const toRgb = (h) => {
  const s = hex(h);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const toHex = (r, g, b) =>
  [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

/** 把 a 按 t 比例混向 b（t=0 全 a，t=1 全 b） */
const mix = (a, b, t) => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

const luminance = (h) => {
  const [r, g, b] = toRgb(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const darken = (h, t) => mix(h, "000000", t);
const lighten = (h, t) => mix(h, "FFFFFF", t);

/**
 * 把任意来源的颜色归一化成 6 位十六进制。
 * presenton 里混着 #RGB、#RRGGBBAA、rgb()/rgba() 几种写法，直接剥 # 会产出非法值
 * （实测 onSection 因此校验失败）。
 */
function norm(v, fallback) {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  let m = /^#?([0-9a-fA-F]{3})$/.exec(s);
  if (m) return m[1].split("").map((c) => c + c).join("").toUpperCase();
  m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (m) return m[1].toUpperCase();
  m = /^#?([0-9a-fA-F]{8})$/.exec(s);
  if (m) return m[1].slice(0, 6).toUpperCase();
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return toHex(Number(m[1]), Number(m[2]), Number(m[3]));
  return fallback;
}

/* ------------------------------------------------------- 字体性格 → 白名单 */

const F = {
  yahei: "Microsoft YaHei",
  dengxian: "DengXian",
  noto: "Noto Sans SC",
  simsun: "SimSun",
  latin: "Arial",
  mono: "Consolas",
};

/** 依据 presenton 的字体名与配色，决定中文用哪套 + 是否用宋体做大标题 */
function pickFonts(fontNames, colors) {
  const joined = fontNames.join(" ").toLowerCase();
  const serif = /playfair|serif|georgia|garamond/.test(joined);
  const ultraBold = /anton|archivo black|ultra|heavy/.test(joined);
  const light = /light|thin/.test(joined);

  const bodyZh = serif || light ? F.dengxian : F.yahei;
  const display = serif ? F.simsun : bodyZh;
  return { zh: bodyZh, en: F.latin, mono: F.mono, display, serif, ultraBold };
}

/* ------------------------------------------------ 配色性格 → 构图语言 */

function pickComposition(colors, fontMeta) {
  const darkBg = luminance(colors.background) < 0.25;
  const strongPrimary = luminance(colors.primary) < 0.35;

  if (fontMeta.serif) return "editorial";
  if (darkBg) return "rail";
  if (strongPrimary && luminance(colors.card) > 0.85) return "band";
  return "card";
}

/* ------------------------------------------------------------ 生成 token */

function toTokens(t) {
  const c = t.theme?.colors ?? {};
  const primary = norm(c.primary, "#1F3864");
  const background = norm(c.background, "#FFFFFF");
  const card = norm(c.card, lighten(background, 0.5));
  const stroke = norm(c.stroke, mix(background, "000000", 0.12));
  const primaryText = norm(c.primary_text, "FFFFFF");
  const bgText = norm(
    c.background_text,
    luminance(background) < 0.25 ? "#FFFFFF" : "#1A1A1A"
  );

  const secondary = norm(c.graph_0, mix(primary, background, 0.3));
  const accent = norm(c.graph_2 ?? c.graph_5, lighten(primary, 0.3));

  const dark = luminance(background) < 0.25;
  // 章节页底色：深色主题用更深一档，浅色主题用主色
  const sectionBg = dark ? darken(background, 0.35) : darken(primary, 0.12);
  const onSection = luminance(sectionBg) < 0.4 ? "FFFFFF" : bgText;

  const text1 = bgText;
  const text2 = mix(bgText, background, 0.38);
  const text3 = mix(bgText, background, 0.62);

  const fontMeta = pickFonts(Object.keys(t.fonts ?? {}), { ...c, primary, background, card });

  return {
    tokens: {
      colors: {
        primary,
        secondary,
        accent,
        background,
        surface: card,
        onPrimary: primaryText,
        sectionBg,
        onSection,
        text1,
        text2,
        text3,
      },
      fonts: fontMeta,
      rhythm: { unit: 8, sectionGap: 32 },
      radius: fontMeta.serif ? 2 : 10,
      border: { width: 1, color: stroke },
      lineHeight: { title: fontMeta.serif ? 1.28 : 1.2, body: fontMeta.serif ? 1.6 : 1.5 },
    },
    composition: pickComposition({ ...c, primary, background, card }, fontMeta),
  };
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
  const imported = [];
  for (const id of IDS) {
    try {
      const res = await fetch(`${BASE}/${id}/template.json`);
      if (!res.ok) {
        console.log(`skip ${id}: HTTP ${res.status}`);
        continue;
      }
      const t = await res.json();
      const { tokens, composition } = toTokens(t);

      // 合理性校验：页面底色要么很亮（浅色模板）要么很暗（深色模板）。
      // 落在中间亮度说明 theme.colors 结构不同、字段映射错位（实测 general / standard 就是这种），直接跳过。
      const bgL = luminance(tokens.colors.background);
      const textL = luminance(tokens.colors.text1);
      if (bgL > 0.2 && bgL < 0.82) {
        console.log(`skip ${id}: 背景亮度 ${bgL.toFixed(2)} 落在中间区，疑为字段错位`);
        continue;
      }
      const contrast = Math.abs(bgL - textL);
      if (contrast < 0.45) {
        console.log(`skip ${id}: 背景/文字对比不足（ΔL=${contrast.toFixed(2)}）`);
        continue;
      }

      imported.push({
        id: `presenton-${id}`,
        name: `${prettyName(id)}`,
        description: `导入自 presenton（Apache-2.0）的 ${id} 配色与字体性格`,
        tone: luminance(tokens.colors.background) < 0.25 ? "dark" : "light",
        composition,
        tokens,
        source: { project: "presenton/presenton", license: "Apache-2.0", path: `templates/${id}/template.json` },
      });
      console.log(`✓ ${id.padEnd(11)} ${composition.padEnd(9)} primary=#${tokens.colors.primary} bg=#${tokens.colors.background} display=${tokens.fonts.display}`);
    } catch (e) {
      console.log(`ERR ${id}: ${e.message}`);
    }
  }

  const header = `/**
 * 由 scripts/import-presenton.mjs 自动生成，**请勿手改**。
 *
 * 来源：presenton/presenton（Apache-2.0），只导入配色与字体性格，未导入其元素树。
 * 重新生成：node scripts/import-presenton.mjs
 * 许可证与署名登记：docs/03-素材来源.csv
 */
import type { ThemeTokens } from "@/lib/ir/schema";
import type { CompositionId } from "@/lib/layout/compositions";

export interface ImportedTheme {
  id: string;
  name: string;
  description: string;
  tone: "light" | "dark";
  composition: CompositionId;
  tokens: Omit<ThemeTokens, "fonts"> & {
    fonts: { zh: string; en: string; mono: string; display?: string; serif?: boolean; ultraBold?: boolean };
  };
  source: { project: string; license: string; path: string };
}

export const IMPORTED_THEMES: ImportedTheme[] = `;

  const out = header + JSON.stringify(imported, null, 2) + ";\n";
  const file = path.resolve("src/lib/theme/imported.ts");
  fs.writeFileSync(file, out, "utf8");
  console.log(`\n已生成 ${file}：${imported.length} 套模板`);
}

function prettyName(id) {
  const map = {
    editorial: "导入·编辑",
    nova: "导入·新星",
    mosaic: "导入·马赛克",
    pulse: "导入·脉搏",
    civic: "导入·公民",
    executive: "导入·高管",
    landmark: "导入·地标",
    momentum: "导入·动能",
    horizon: "导入·地平线",
    signal: "导入·信号",
    modern: "导入·现代",
    general: "导入·通用",
    dynamic: "导入·动感",
    standard: "导入·标准",
  };
  return map[id] ?? `导入·${id}`;
}

main();
