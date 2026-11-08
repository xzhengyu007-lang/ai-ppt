/**
 * 图库接入 —— Wikimedia Commons（维基共享资源）。
 *
 * 为什么选它（而不是 Unsplash/Pexels）：
 *  1. **无需 API Key** → 静态演示版也能用，不会把 Key 暴露进浏览器；
 *  2. **CORS 开放**（带 origin=*）→ 浏览器可直接请求；
 *  3. **API 直接返回许可证与作者**（extmetadata）→ 天然满足"外部素材必须登记 + 署名"的红线。
 *
 * 只接受可商用的许可证：CC0 / Public domain / CC BY / CC BY-SA。
 * 其他（如 CC BY-NC、Fair use）一律丢弃——宁可图少，不留法律隐患。
 */

export interface ImageHit {
  id: string;
  /** 用于页面展示的缩略图（约 1600px 宽） */
  url: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl?: string;
  /** 原始文件页，署名时给出处用 */
  sourceUrl: string;
  title: string;
}

const API = "https://commons.wikimedia.org/w/api.php";

/** 允许的许可证（短的规范化名字） */
const ALLOWED = [
  "cc0",
  "public domain",
  "cc by 2.0",
  "cc by 3.0",
  "cc by 4.0",
  "cc by-sa 2.0",
  "cc by-sa 3.0",
  "cc by-sa 4.0",
  "cc by sa 4.0",
];

/** 明确禁止的（命中即丢弃） */
const DENY = ["nc", "non-commercial", "fair use", "no derivative", "nd"];

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function licenseOk(name: string): boolean {
  const n = name.toLowerCase();
  if (!n) return false;
  if (DENY.some((d) => n.includes(d) && !n.includes("cc0"))) return false;
  return ALLOWED.some((a) => n.includes(a));
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    width: number;
    height: number;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

/**
 * 搜索可商用的配图。
 * @param query 关键词（中文/英文都行；中文命中率低时建议用英文）
 * @param limit 最多返回几张
 */
export async function searchCommons(query: string, limit = 12): Promise<ImageHit[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", // File:
    gsrlimit: String(Math.min(40, limit * 3)),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
  });

  const res = await fetch(`${API}?${params.toString()}`, {
    headers: { "accept": "application/json" },
  });
  if (!res.ok) throw new Error(`图库请求失败：HTTP ${res.status}`);

  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(data.query?.pages ?? {});

  const hits: ImageHit[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!licenseOk(license)) continue;

    // 过滤掉过小的图（做 16:9 版面会糊）
    const w = info.width ?? 0;
    const h = info.height ?? 0;
    if (w < 900 || h < 500) continue;

    const author = stripHtml(meta.Artist?.value ?? "") || "未署名";

    hits.push({
      id: String(p.pageid),
      url: info.thumburl ?? info.url,
      width: w,
      height: h,
      author,
      license,
      licenseUrl: meta.LicenseUrl ? stripHtml(meta.LicenseUrl.value) : undefined,
      sourceUrl: info.descriptionurl,
      title: p.title.replace(/^File:/, ""),
    });

    if (hits.length >= limit) break;
  }

  return hits;
}

/** 生成一行可直接写进 caption / 素材登记的署名文本 */
export function creditLine(hit: ImageHit): string {
  return `图：${hit.author} / ${hit.license} · Wikimedia Commons`;
}
