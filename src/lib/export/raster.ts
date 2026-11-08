/**
 * 栅格化：ResolvedSlide → PNG。
 *
 * 只读 ResolvedSlide（和 DOM/pptx 渲染器同一份数据），所以逐页 PNG 与预览一致。
 * 不引入 html2canvas —— 它会重排 DOM、受外部字体影响，产物不可控；
 * 这里按元素直接画，坐标与字号全部来自 IR，确定性强。
 */
import type { ResolvedSlide } from "@/lib/layout/resolve";
import { bulletItemBoxes } from "@/lib/layout/resolve";

const SCALE = 2; // 2x 输出，1280×720 → 2560×1440

export async function rasterizeSlide(slide: ResolvedSlide): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = slide.width * SCALE;
  canvas.height = slide.height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas 2D");
  ctx.scale(SCALE, SCALE);

  // 底色
  ctx.fillStyle = `#${slide.background}`;
  ctx.fillRect(0, 0, slide.width, slide.height);

  for (const el of slide.elements) {
    if (el.kind === "shape") {
      ctx.save();
      ctx.fillStyle = `#${el.fill ?? "FFFFFF"}`;
      if (el.radius) {
        roundRect(ctx, el.box.x, el.box.y, el.box.w, el.box.h, el.radius);
        ctx.fill();
      } else {
        ctx.fillRect(el.box.x, el.box.y, Math.max(el.box.w, 0.5), Math.max(el.box.h, 0.5));
      }
      if (el.line) {
        ctx.strokeStyle = `#${el.line.color}`;
        ctx.lineWidth = el.line.width;
        ctx.strokeRect(el.box.x, el.box.y, el.box.w, el.box.h);
      }
      ctx.restore();
    } else if (el.kind === "text") {
      drawTextBlock(ctx, el.box, el.block);
    } else if (el.kind === "bullets") {
      // 条目几何与 DOM/pptx 渲染器同源
      const boxes = bulletItemBoxes(el.box, el.items.length, el.items[0].block.fontSize);
      el.items.forEach((item, i) => {
        const { dotBox, textBox } = boxes[i];
        ctx.save();
        ctx.fillStyle = `#${el.markerColor}`;
        ctx.beginPath();
        ctx.arc(dotBox.x + dotBox.w / 2, dotBox.y + dotBox.h / 2, dotBox.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawTextBlock(ctx, textBox, item.block);
      });
    } else if (el.kind === "chart") {
      drawChart(ctx, el);
    } else if (el.kind === "image") {
      ctx.fillStyle = "#F0F2F5";
      ctx.fillRect(el.box.x, el.box.y, el.box.w, el.box.h);
      ctx.strokeStyle = "#C9CFD8";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(el.box.x, el.box.y, el.box.w, el.box.h);
      ctx.setLineDash([]);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob 失败"))), "image/png");
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  block: {
    lines: string[];
    fontSize: number;
    lineHeightPx: number;
    color: string;
    fontFace: string;
    bold: boolean;
    align: "left" | "center" | "right";
    valign: "top" | "middle" | "bottom";
    visibleLines: number;
  },
  offsetY = 0
) {
  const totalH = block.lines.length * block.lineHeightPx;
  let y =
    block.valign === "middle"
      ? box.y + offsetY + (box.h - totalH) / 2
      : block.valign === "bottom"
        ? box.y + offsetY + box.h - totalH
        : box.y + offsetY;

  ctx.save();
  ctx.font = `${block.bold ? 700 : 400} ${block.fontSize}px "${block.fontFace}", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = `#${block.color}`;
  ctx.textBaseline = "top";
  ctx.textAlign = block.align === "center" ? "center" : block.align === "right" ? "right" : "left";
  const tx = block.align === "center" ? box.x + box.w / 2 : block.align === "right" ? box.x + box.w : box.x;

  block.lines.forEach((line, i) => {
    if (i >= block.visibleLines) return;
    ctx.fillText(line, tx, y + (block.lineHeightPx - block.fontSize) / 2);
    y += block.lineHeightPx;
  });
  ctx.restore();
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  el: Extract<ResolvedSlide["elements"][number], { kind: "chart" }>
) {
  const { box, chart, colors } = el;
  const padL = 48;
  const padB = 36;
  const padT = 16;
  const plotW = box.w - padL - 16;
  const plotH = box.h - padT - padB;
  const maxV = Math.max(1, ...chart.series.flatMap((s) => s.values));

  ctx.save();
  ctx.strokeStyle = "#C9CFD8";
  ctx.beginPath();
  ctx.moveTo(box.x + padL, box.y + padT + plotH);
  ctx.lineTo(box.x + box.w - 16, box.y + padT + plotH);
  ctx.stroke();

  const groupW = plotW / Math.max(1, chart.categories.length);
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = "#6B7280";
  ctx.textAlign = "center";
  chart.categories.forEach((c, ci) => {
    ctx.fillText(c, box.x + padL + groupW * (ci + 0.5), box.y + padT + plotH + 18);
  });

  if (chart.type === "bar") {
    const bw = (groupW - 12) / chart.series.length;
    chart.series.forEach((s, si) => {
      s.values.forEach((v, vi) => {
        const bh = (v / maxV) * plotH;
        ctx.fillStyle = `#${colors[si % colors.length]}`;
        ctx.fillRect(
          box.x + padL + groupW * vi + 6 + si * bw,
          box.y + padT + plotH - bh,
          Math.max(2, bw - 2),
          bh
        );
      });
    });
  } else if (chart.type === "line") {
    chart.series.forEach((s, si) => {
      ctx.strokeStyle = `#${colors[si % colors.length]}`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      s.values.forEach((v, vi) => {
        const x = box.x + padL + groupW * (vi + 0.5);
        const y = box.y + padT + plotH - (v / maxV) * plotH;
        if (vi === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  } else {
    const values = chart.series[0]?.values ?? [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(plotW, plotH) / 2;
    const cx = box.x + padL + plotW / 2;
    const cy = box.y + padT + plotH / 2;
    let acc = 0;
    values.forEach((v, i) => {
      const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += v;
      const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = `#${colors[i % colors.length]}`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();
    });
  }
  ctx.restore();
}
