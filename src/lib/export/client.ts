/**
 * 浏览器端导出：IR → ResolvedSlide → pptx → 后处理 → 下载。
 *
 * 全流程在客户端完成，**没有导出服务器、没有 LibreOffice**。
 * 这条路线被 9,472★ 的 PPTist 走通过，也被我们自己的 spike 实测过。
 */
"use client";

import type { Deck } from "@/lib/ir/schema";
import { resolveDeck } from "@/lib/layout/resolve";
import { renderDeckToBuffer } from "@/lib/renderer/pptx/renderPptx";
import { postProcessPptx } from "@/lib/renderer/pptx/postprocess";

export interface ExportResult {
  blob: Blob;
  fileName: string;
  fixes: string[];
  sizeKb: number;
}

function safeFileName(title: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}_${ymd}`;
}

export async function exportDeckPptx(deck: Deck): Promise<ExportResult> {
  const slides = resolveDeck(deck);
  const raw = await renderDeckToBuffer(slides, { title: deck.meta.title });
  const { buffer, fixes } = await postProcessPptx(raw);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  return {
    blob,
    fileName: `${safeFileName(deck.meta.title)}.pptx`,
    fixes,
    sizeKb: Math.round(blob.size / 1024),
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** 逐页 PNG：按 IR 栅格化，产物与预览一致 */
export async function exportSlidePng(deck: Deck, index: number): Promise<ExportResult> {
  const slides = resolveDeck(deck);
  const target = slides[index];
  if (!target) throw new Error(`第 ${index + 1} 页不存在`);
  const { rasterizeSlide } = await import("./raster");
  const blob = await rasterizeSlide(target);
  return {
    blob,
    fileName: `${safeFileName(deck.meta.title)}_p${index + 1}.png`,
    fixes: [],
    sizeKb: Math.round(blob.size / 1024),
  };
}
