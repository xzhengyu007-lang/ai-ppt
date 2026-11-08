/**
 * 12 套主题（= 12 套模板）。全部原创、代码生成，不抓任何商业模板。
 *
 * 设计约束（踩过的坑）：
 *  1. `primary` 是**标题与图表主色**，必须与本套 `background` 有足够对比；
 *  2. 章节页/结尾页的大面积底色用独立的 `sectionBg`，深色主题才不会出现
 *     「深底 + 深色标题」的自相矛盾；
 *  3. 字体只用白名单：Microsoft YaHei / DengXian / Noto Sans SC / SimSun。
 */
import type { ThemeTokens } from "@/lib/ir/schema";
import { FONT_WHITELIST } from "@/lib/ir/constants";

export interface ThemeDef {
  id: string;
  name: string;
  /** 一句话风格描述，模板墙用 */
  description: string;
  /** 明/暗，仅用于 UI 选择器分组 */
  tone: "light" | "dark";
  tokens: ThemeTokens;
}

const F = FONT_WHITELIST;

export const THEMES: ThemeDef[] = [
  {
    id: "business-navy",
    name: "商务深蓝",
    description: "稳重可信，适合季度复盘与董事会汇报",
    tone: "light",
    tokens: {
      colors: {
        primary: "1F3864",
        secondary: "2E5597",
        accent: "C9A227",
        background: "F7F8FA",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "1F3864",
        onSection: "FFFFFF",
        text1: "1A1D24",
        text2: "4A5160",
        text3: "8A91A0",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 4,
      border: { width: 1, color: "DCE0E8" },
      lineHeight: { title: 1.2, body: 1.5 },
    },
  },
  {
    id: "minimal-mono",
    name: "极简黑白",
    description: "高信息密度，除去一切装饰，适合内部评审",
    tone: "light",
    tokens: {
      colors: {
        primary: "111111",
        secondary: "444444",
        accent: "111111",
        background: "FFFFFF",
        surface: "FAFAFA",
        onPrimary: "FFFFFF",
        sectionBg: "111111",
        onSection: "FFFFFF",
        text1: "1A1A1A",
        text2: "555555",
        text3: "999999",
      },
      fonts: { zh: F.notoSC, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 28 },
      radius: 0,
      border: { width: 1, color: "E5E5E5" },
      lineHeight: { title: 1.15, body: 1.55 },
    },
  },
  {
    id: "tech-dark",
    name: "科技暗色",
    description: "深色舞台感，适合产品技术分享与发布会",
    tone: "dark",
    tokens: {
      colors: {
        primary: "E8F0FF",
        secondary: "9FB6E8",
        accent: "4DD0E1",
        background: "0B1020",
        surface: "141A2E",
        onPrimary: "0B1020",
        sectionBg: "050A18",
        onSection: "FFFFFF",
        text1: "E6ECFF",
        text2: "A9B4CC",
        text3: "6B7690",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 36 },
      radius: 6,
      border: { width: 1, color: "25304A" },
      lineHeight: { title: 1.2, body: 1.55 },
    },
  },
  {
    id: "academic",
    name: "学术答辩",
    description: "克制、密排，适合论文答辩与课题汇报",
    tone: "light",
    tokens: {
      colors: {
        primary: "1B3A5C",
        secondary: "345660",
        accent: "8C4A2F",
        background: "FFFFFF",
        surface: "F4F6F9",
        onPrimary: "FFFFFF",
        sectionBg: "1B3A5C",
        onSection: "FFFFFF",
        text1: "20242B",
        text2: "4C5461",
        text3: "8B929E",
      },
      fonts: { zh: F.dengxian, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 28 },
      radius: 2,
      border: { width: 1, color: "D7DCE3" },
      lineHeight: { title: 1.25, body: 1.55 },
    },
  },
  {
    id: "fresh-green",
    name: "清新浅绿",
    description: "轻松友好，适合培训与项目启动会",
    tone: "light",
    tokens: {
      colors: {
        primary: "1E5C43",
        secondary: "2F7F5E",
        accent: "3AA76D",
        background: "F6FBF7",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "1E5C43",
        onSection: "FFFFFF",
        text1: "1C2B24",
        text2: "465A50",
        text3: "8AA096",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 8,
      border: { width: 1, color: "D6E7DC" },
      lineHeight: { title: 1.2, body: 1.5 },
    },
  },
  {
    id: "gov-red",
    name: "政务红",
    description: "庄重规范，适合政务汇报与政策解读",
    tone: "light",
    tokens: {
      colors: {
        primary: "9A1E24",
        secondary: "B33A3F",
        accent: "C9A227",
        background: "FFFDFB",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "8C1A20",
        onSection: "FFFFFF",
        text1: "22181A",
        text2: "554043",
        text3: "9B8588",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 2,
      border: { width: 1, color: "EBDADA" },
      lineHeight: { title: 1.22, body: 1.52 },
    },
  },
  {
    id: "product-launch",
    name: "产品发布",
    description: "强对比、大留白，适合新品发布与路演",
    tone: "dark",
    tokens: {
      colors: {
        primary: "F5F7FA",
        secondary: "B9C2D0",
        accent: "FF4D6D",
        background: "0F1115",
        surface: "1A1D24",
        onPrimary: "0F1115",
        sectionBg: "000000",
        onSection: "FFFFFF",
        text1: "EDEFF3",
        text2: "A7AEBC",
        text3: "6E7686",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 40 },
      radius: 12,
      border: { width: 1, color: "2A2F3A" },
      lineHeight: { title: 1.18, body: 1.5 },
    },
  },
  {
    id: "edu-warm",
    name: "教育培训",
    description: "温和易读，适合课程讲授与知识普及",
    tone: "light",
    tokens: {
      colors: {
        primary: "2B4C7E",
        secondary: "4468A0",
        accent: "E8A33D",
        background: "FFFDF6",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "2B4C7E",
        onSection: "FFFFFF",
        text1: "23262D",
        text2: "4E5560",
        text3: "8E959F",
      },
      fonts: { zh: F.dengxian, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 10,
      border: { width: 1, color: "E8E2D4" },
      lineHeight: { title: 1.22, body: 1.55 },
    },
  },
  {
    id: "finance-slate",
    name: "金融石墨",
    description: "冷静克制，适合数据密集的经营分析",
    tone: "light",
    tokens: {
      colors: {
        primary: "26303B",
        secondary: "3C4A59",
        accent: "0F7B6C",
        background: "F7F8FA",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "1B242E",
        onSection: "FFFFFF",
        text1: "1A2129",
        text2: "465060",
        text3: "8A94A3",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 30 },
      radius: 3,
      border: { width: 1, color: "D9DEE6" },
      lineHeight: { title: 1.2, body: 1.5 },
    },
  },
  {
    id: "editorial-warm",
    name: "杂志米色",
    description: "文字优先的编辑感，适合深度分析与品牌叙事",
    tone: "light",
    tokens: {
      colors: {
        primary: "3A2E23",
        secondary: "5C4A38",
        accent: "B5651D",
        background: "FBF7F0",
        surface: "FFFFFF",
        onPrimary: "FBF7F0",
        sectionBg: "3A2E23",
        onSection: "FBF7F0",
        text1: "2A241C",
        text2: "5C5346",
        text3: "9A9082",
      },
      fonts: { zh: F.notoSC, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 34 },
      radius: 2,
      border: { width: 1, color: "E5DCCD" },
      lineHeight: { title: 1.3, body: 1.6 },
    },
  },
  {
    id: "modern-violet",
    name: "现代紫",
    description: "年轻有活力，适合创意提案与增长汇报",
    tone: "light",
    tokens: {
      colors: {
        primary: "3B2E7E",
        secondary: "5B4BB5",
        accent: "8B5CF6",
        background: "F8F7FC",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "2A2160",
        onSection: "FFFFFF",
        text1: "1E1B2E",
        text2: "4B4760",
        text3: "8B87A3",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 12,
      border: { width: 1, color: "DCD8EC" },
      lineHeight: { title: 1.2, body: 1.5 },
    },
  },
  {
    id: "corporate-teal",
    name: "企业青",
    description: "清爽可信，适合方案汇报与客户提案",
    tone: "light",
    tokens: {
      colors: {
        primary: "0E4F5C",
        secondary: "1A6C7C",
        accent: "17A2B8",
        background: "F5FAFB",
        surface: "FFFFFF",
        onPrimary: "FFFFFF",
        sectionBg: "0E4F5C",
        onSection: "FFFFFF",
        text1: "16262B",
        text2: "415B62",
        text3: "869CA2",
      },
      fonts: { zh: F.yahei, en: F.latin, mono: F.mono },
      rhythm: { unit: 8, sectionGap: 32 },
      radius: 6,
      border: { width: 1, color: "D2E3E7" },
      lineHeight: { title: 1.2, body: 1.5 },
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string): ThemeDef {
  const t = THEMES.find((x) => x.id === id);
  if (!t) throw new Error(`未知主题：${id}`);
  return t;
}
