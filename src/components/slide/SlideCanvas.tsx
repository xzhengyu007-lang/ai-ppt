"use client";

/**
 * DOM 渲染器 —— 只消费 ResolvedSlide，和 pptx 渲染器吃同一份数据。
 *
 * 为了把「预览 vs 导出」的偏差压到最小，这里做了一件关键的事：
 * **每一行文本独立渲染成一个固定行高的 div**。因为 resolve 阶段已经把折行算死，
 * DOM 不再依赖浏览器的自动换行能力，pptx 侧也逐行写入 —— 两边行数与行位置一致。
 */
import type { ResolvedElement, ResolvedSlide, ResolvedTextBlock } from "@/lib/layout/resolve";
import { bulletItemBoxes } from "@/lib/layout/resolve";

function TextBlockView({ block }: { block: ResolvedTextBlock }) {
  const justify =
    block.valign === "middle"
      ? "center"
      : block.valign === "bottom"
        ? "flex-end"
        : "flex-start";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {block.lines.map((line, i) => (
        <div
          key={i}
          style={{
            height: block.lineHeightPx,
            lineHeight: `${block.lineHeightPx}px`,
            fontSize: block.fontSize,
            fontFamily: block.fontFace,
            fontWeight: block.bold ? 700 : 400,
            color: `#${block.color}`,
            textAlign: block.align,
            letterSpacing: block.letterSpacing || undefined,
            // 等宽数字：KPI 与数据页的 4/9 不下沉、对齐更稳（对中文无影响）
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "pre",
            // 预折行：不接受浏览器再换行
            overflow: "visible",
          }}
        >
          {line || "\u00a0"}
        </div>
      ))}
    </div>
  );
}

function MiniChart({ el }: { el: Extract<ResolvedElement, { kind: "chart" }> }) {
  const { chart, colors } = el;
  const w = el.box.w;
  const h = el.box.h;
  const padL = 48;
  const padB = 36;
  const padT = 16;
  const padR = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const cats = chart.categories;
  const maxV = Math.max(1, ...chart.series.flatMap((s) => s.values));

  if (chart.type === "pie") {
    const values = chart.series[0]?.values ?? [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(plotW, plotH) / 2;
    const cx = padL + plotW / 2;
    const cy = padT + plotH / 2;
    let acc = 0;
    return (
      <svg width={w} height={h} style={{ display: "block" }}>
        {values.map((v, i) => {
          const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += v;
          const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const x0 = cx + r * Math.cos(a0);
          const y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
              fill={`#${colors[i % colors.length]}`}
            />
          );
        })}
      </svg>
    );
  }

  const groupW = plotW / Math.max(1, cats.length);
  const barGap = 6;

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {/* 基线 */}
      <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#C9CFD8" strokeWidth={1} />
      {cats.map((c, ci) => (
        <text
          key={`c-${ci}`}
          x={padL + groupW * (ci + 0.5)}
          y={h - padB + 18}
          fontSize={12}
          textAnchor="middle"
          fill="#6B7280"
        >
          {c}
        </text>
      ))}
      {chart.series.map((s, si) =>
        s.values.map((v, vi) => {
          const bw = chart.type === "bar" ? (groupW - barGap * 2) / chart.series.length : 0;
          if (chart.type === "bar") {
            const bh = (v / maxV) * plotH;
            const x =
              padL + groupW * vi + barGap + si * (bw + 2) + (groupW - barGap * 2 - bw * chart.series.length) / 2;
            return (
              <rect
                key={`b-${si}-${vi}`}
                x={x}
                y={padT + plotH - bh}
                width={Math.max(2, bw)}
                height={bh}
                fill={`#${colors[si % colors.length]}`}
              />
            );
          }
          return null;
        })
      )}
      {chart.type === "line" &&
        chart.series.map((s, si) => {
          const pts = s.values.map((v, vi) => {
            const x = padL + groupW * (vi + 0.5);
            const y = padT + plotH - (v / maxV) * plotH;
            return `${x},${y}`;
          });
          return (
            <polyline
              key={`l-${si}`}
              points={pts.join(" ")}
              fill="none"
              stroke={`#${colors[si % colors.length]}`}
              strokeWidth={2.5}
            />
          );
        })}
    </svg>
  );
}

function ElementView({ el }: { el: ResolvedElement }) {
  const base = {
    position: "absolute" as const,
    left: el.box.x,
    top: el.box.y,
    width: el.box.w,
    height: el.box.h,
  };

  switch (el.kind) {
    case "shape":
      return (
        <div
          style={{
            ...base,
            background: el.fill ? `#${el.fill}` : "transparent",
            border: el.line ? `${el.line.width}px solid #${el.line.color}` : undefined,
            borderRadius: el.radius ?? 0,
          }}
        />
      );
    case "text":
      return (
        <div style={base}>
          <TextBlockView block={el.block} />
        </div>
      );
    case "bullets": {
      // 与 pptx 渲染器共用同一份条目几何
      const boxes = bulletItemBoxes(el.box, el.items.length, el.items[0].block.fontSize);
      return (
        <div style={base}>
          {el.items.map((item, i) => {
            const { dotBox, textBox } = boxes[i];
            return (
              <div key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: dotBox.x - el.box.x,
                    top: dotBox.y - el.box.y,
                    width: dotBox.w,
                    height: dotBox.h,
                    borderRadius: "50%",
                    background: `#${el.markerColor}`,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: textBox.x - el.box.x,
                    top: textBox.y - el.box.y,
                    width: textBox.w,
                    height: textBox.h,
                  }}
                >
                  <TextBlockView block={item.block} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    case "chart":
      return (
        <div style={base}>
          <MiniChart el={el} />
        </div>
      );
    case "image":
      return el.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={el.src} alt={el.alt ?? ""} style={{ ...base, objectFit: "cover" }} />
      ) : (
        <div
          style={{
            ...base,
            background: "#F0F2F5",
            border: "1px dashed #C9CFD8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8A91A0",
            fontSize: 13,
          }}
        >
          {el.alt ?? "图片占位"}
        </div>
      );
  }
}

export function SlideFrame({
  slide,
  scale = 1,
  className,
}: {
  slide: ResolvedSlide;
  scale?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: slide.width * scale,
        height: slide.height * scale,
        overflow: "hidden",
        background: `#${slide.background}`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: slide.width,
          height: slide.height,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "relative",
        }}
      >
        {slide.elements.map((el) => (
          <ElementView key={el.id} el={el} />
        ))}
      </div>
    </div>
  );
}

/** 自适应宽度的画布：容器多宽就缩放到多宽 */
export function SlideCanvas({
  slide,
  containerWidth,
  className,
}: {
  slide: ResolvedSlide;
  containerWidth: number;
  className?: string;
}) {
  const scale = containerWidth / slide.width;
  return <SlideFrame slide={slide} scale={scale} className={className} />;
}
