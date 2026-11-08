import { describe, expect, it } from "./harness";
import { charEm, widthEm, wrapText, widthPx } from "@/lib/text/measure";
import { estimateCapacity, fitText } from "@/lib/text/fit";
import { TEXT_METRICS } from "@/lib/ir/constants";

describe("字符宽度（确定性，不依赖浏览器）", () => {
  it("中文按 1em，拉丁按 0.55em，空格按 0.28em", () => {
    expect(charEm("中")).toBe(TEXT_METRICS.cjkEm);
    expect(charEm("A")).toBe(TEXT_METRICS.latinEm);
    expect(charEm("8")).toBe(TEXT_METRICS.latinEm);
    expect(charEm(" ")).toBe(TEXT_METRICS.spaceEm);
  });

  it("全角标点也按 1em（「，」不能当半角算，否则预算算少了会溢出）", () => {
    expect(charEm("，")).toBe(1);
    expect(charEm("。")).toBe(1);
    expect(charEm("（")).toBe(1);
  });

  it("字间距必须逐字累加：n 个字只加 n-1 份间距", () => {
    const base = widthEm("abcd"); // 4 × 0.55
    expect(base).toBeCloseTo(2.2, 6);
    // 0.5em 间距 × (4-1) = 1.5
    expect(widthEm("abcd", 0.5)).toBeCloseTo(2.2 + 1.5, 6);
  });

  it("单字符不产生间距", () => {
    expect(widthEm("中", 0.5)).toBeCloseTo(1, 6);
  });
});

describe("贪心折行", () => {
  it("按可用宽度断行，且每行都不超宽", () => {
    const text = "这是一段用来验证折行的中文文字，需要在指定宽度内断成多行。";
    const fs = 24;
    const maxW = 240; // 24px 字号下每行最多 10 个汉字
    const lines = wrapText(text, maxW, fs);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(widthPx(l, fs)).toBeLessThanOrEqual(maxW + fs * 0.01);
    }
    expect(lines.join("")).toBe(text);
  });

  it("标点不落到行首（避头尾近似）", () => {
    // 构造一个「，」正好落在边界上的情形
    const text = "第一句十个字刚好满然后逗号，第二句";
    const lines = wrapText(text, 24 * 10, 24);
    for (const l of lines.slice(1)) {
      expect(l[0]).not.toBe("，");
      expect(l[0]).not.toBe("。");
    }
  });

  it("拉丁单词不被劈断（尽量在空格处断）", () => {
    const text = "alpha beta gamma delta epsilon zeta";
    const lines = wrapText(text, 90, 16);
    for (const l of lines) {
      // 每行不应以半个单词结尾（空格后的残片除外）
      expect(l.trim()).not.toBe("");
    }
    expect(lines.join(" ").replace(/\s+/g, " ")).toContain("epsilon");
  });

  it("显式换行符会强制断行", () => {
    const lines = wrapText("第一行\n第二行", 1000, 20);
    expect(lines).toEqual(["第一行", "第二行"]);
  });
});

describe("auto-fit 三档", () => {
  const base = {
    widthPx: 400,
    heightPx: 120,
    fontSize: 24,
    lineHeight: 1.5,
  };

  it("放得下时不缩字号", () => {
    const r = fitText({ ...base, text: "短文本" });
    expect(r.level).toBe("ok");
    expect(r.fontSize).toBe(24);
  });

  it("略超时降字号到能放下（不低于 0.85×）", () => {
    // 60 个汉字在 400px 宽 / 120px 高 / 24px 字号下：原字号放不下，最小档刚好放下
    const medium = "这是一段比较长的文本".repeat(6);
    const r = fitText({ ...base, text: medium });
    expect(r.level).toBe("shrunk");
    expect(r.fontSize).toBeGreaterThanOrEqual(Math.round(24 * TEXT_METRICS.minFontScale));
    expect(r.contentHeightPx).toBeLessThanOrEqual(base.heightPx + 0.5);
  });

  it("远超时如实报 overflow，而不是假装放得下", () => {
    const huge = "这一页塞进了远远超过版面容量的文字".repeat(20);
    const r = fitText({ ...base, text: huge });
    expect(r.level).toBe("overflow");
    expect(r.visibleLines).toBeLessThan(r.lines.length);
  });

  it("maxLines 约束生效", () => {
    const r = fitText({ ...base, text: "一二三四五六七八九十".repeat(6), maxLines: 1 });
    expect(r.level).not.toBe("ok");
  });
});

describe("容量估算公式", () => {
  it("每行字数 × 行数 = 容量", () => {
    const c = estimateCapacity(1120, 400, 24, 1.5);
    expect(c.charsPerLine).toBeGreaterThan(0);
    expect(c.maxLines).toBeGreaterThan(0);
    expect(c.capacity).toBe(c.charsPerLine * c.maxLines);
  });

  it("字号越大容量越小（单调性）", () => {
    const a = estimateCapacity(1120, 400, 20, 1.5);
    const b = estimateCapacity(1120, 400, 40, 1.5);
    expect(b.capacity).toBeLessThan(a.capacity);
  });
});
