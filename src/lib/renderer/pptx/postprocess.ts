/**
 * 出口后处理 —— 兜住库的缺陷，这一步是**必需**的不是优化。
 *
 * 实测依据（docs/research/F-导出spike2-版本A-B实测.md §1.3/1.5）：
 *  1. pptxgenjs-plus 4.3.6 把 notesMaster 写成了空骨架（1113 B、0 个占位符），
 *     而 4.0.1 是合规的 7504 B / 6 个占位符 —— 直接替换回合规版本；
 *  2. 两个版本的 pptxgenjs 都**完全不压缩** zip（STORE），重打包可省约 75% 体积，
 *     对"浏览器一键下载"是白拿的收益。
 */
import JSZip from "jszip";
import { NOTES_MASTER_XML } from "./notes-master";

export interface PostProcessResult {
  buffer: ArrayBuffer;
  /** 实际做了哪些修补，UI 与日志都要能看到，不静默 */
  fixes: string[];
}

const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export async function postProcessPptx(input: ArrayBuffer): Promise<PostProcessResult> {
  const fixes: string[] = [];
  const zip = await JSZip.loadAsync(input);

  // ---- 1. 备注母版：空骨架 → 合规结构 ----
  const nmName = "ppt/notesMasters/notesMaster1.xml";
  const nm = zip.file(nmName);
  if (nm) {
    const xml = await nm.async("string");
    const placeholders = (xml.match(/<p:ph\b/g) ?? []).length;
    if (placeholders < 6) {
      zip.file(nmName, NOTES_MASTER_XML);
      fixes.push(`notesMaster 占位符 ${placeholders}/6 → 已替换为合规结构`);
    }
  } else {
    fixes.push("警告：未找到 notesMaster，备注页显示可能异常");
  }

  // ---- 2. 清理所有 XML 部件里的 XML 1.0 非法控制字符 ----
  const xmlNames = Object.keys(zip.files).filter((n) => /\.(xml|rels)$/.test(n));
  let cleaned = 0;
  for (const n of xmlNames) {
    const f = zip.file(n);
    if (!f) continue;
    const s = await f.async("string");
    if (ILLEGAL_XML.test(s)) {
      zip.file(n, s.replace(new RegExp(ILLEGAL_XML.source, "g"), ""));
      cleaned++;
    }
  }
  if (cleaned) fixes.push(`清理了 ${cleaned} 个 XML 部件的非法控制字符`);

  // ---- 3. 重打包并压缩 ----
  const out = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const before = input.byteLength;
  const after = (out as ArrayBuffer).byteLength;
  if (after < before) {
    fixes.push(`重打包压缩：${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
  }

  return { buffer: out as ArrayBuffer, fixes };
}
