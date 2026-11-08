/**
 * mock 生成器 —— 无 Key 时的完整闭环。
 *
 * 硬要求来源：任务书「无 Key 也能跑：mock 模式 + CI 不依赖外网」。
 * 这里不调用任何网络，纯本地拼一份结构完整、可直接渲染和导出的 deck，
 * 并且刻意让它覆盖全部 8 种版式，这样 mock 模式本身就是版式回归测试。
 */
import { LAYOUT_IDS } from "@/lib/ir/constants";
import type { Deck, Slide, SlotContent } from "@/lib/ir/schema";
import type { ThemeDef } from "@/lib/theme/themes";
import { getTheme } from "@/lib/theme/themes";

const now = () => new Date().toISOString();

/** 备注写作模板：每页 ≥80 字，导出时进 addNotes */
function notes(topic: string, point: string, detail: string): string {
  return (
    `这一页的主题是${point}。请先给出结论，再展开支撑它的事实：${detail}` +
    `围绕「${topic}」这条主线，本页承担的是论证而不是叙述，所以只讲一个判断和它的两条依据。` +
    `如果听众追问，补一句边界条件——这个结论在什么前提下成立、什么情况下需要修正。` +
    `收尾时用一句话把本页与下一页接起来，不要停顿在数据上。`
  );
}

export interface MockDeckOptions {
  topic?: string;
  themeId?: string;
  /** 生成几页，默认 10；会自动按版式轮转 */
  slideCount?: number;
}

/** 生成一份可直接渲染的 deck（覆盖 8 种版式） */
export function buildMockDeck(opts: MockDeckOptions = {}): Deck {
  const topic = opts.topic?.trim() || "2026 年 Q3 业务复盘";
  const theme: ThemeDef = getTheme(opts.themeId ?? "business-navy");
  const count = opts.slideCount ?? 10;

  const all: Slide[] = [
    {
      id: "s1",
      layout: "cover",
      slots: {
        eyebrow: { kind: "text", text: "战略与运营中心" },
        title: { kind: "text", text: `${topic}：三条增长曲线已经成形` },
        subtitle: { kind: "text", text: "面向管理层的季度经营复盘 · 2026 年 10 月" },
        footer: { kind: "text", text: "内部资料 · 请勿外传" },
      },
      notes: notes(topic, "本次复盘的结论", "三条增长曲线分别来自存量提价、增量客户和交付效率。"),
      warnings: [],
    },
    {
      id: "s2",
      layout: "toc",
      slots: {
        title: { kind: "text", text: "本次复盘的四条主线" },
        body: {
          kind: "bullets",
          items: [
            "增长质量：营收加速来自结构而不是一次性冲高",
            "盈利结构：毛利率改善主要来自交付自动化",
            "客户留存：91.2% 创历史新高，但集中在头部客户",
            "下一步：把可复制的部分固化成流程",
          ],
        },
      },
      notes: notes(topic, "四条主线", "先给全局结论，再逐条展开，最后收在可执行的下一步上。"),
      warnings: [],
    },
    {
      id: "s3",
      layout: "section",
      slots: {
        eyebrow: { kind: "text", text: "第一部分" },
        title: { kind: "text", text: "增长质量：加速是结构性的" },
        subtitle: { kind: "text", text: "营收、毛利、留存三个口径互相印证" },
      },
      notes: notes(topic, "第一部分", "用三个口径互相印证同一个判断，避免单一指标的偶然性。"),
      warnings: [],
    },
    {
      id: "s4",
      layout: "bullets",
      slots: {
        title: { kind: "text", text: "营收连续两个季度加速，Q3 增速为全年最高" },
        body: {
          kind: "bullets",
          items: [
            "营收同比增长 18.4%，Q1 到 Q3 逐季加速，不是单点冲高",
            "增长主要来自存量客户扩购，新客贡献占比不到三成",
            "客单价提升 9.6%，说明提价没有伤害成交量",
          ],
        },
      },
      notes: notes(topic, "营收加速", "重点是「逐季加速」和「存量为主」这两点，它们决定了增长能不能持续。"),
      warnings: [],
    },
    {
      id: "s5",
      layout: "data",
      slots: {
        title: { kind: "text", text: "三个核心指标同时改善" },
        kpi: {
          kind: "kpi",
          items: [
            { label: "营收同比", value: "18.4%", delta: "较 Q2 +3.2pt" },
            { label: "毛利率", value: "40.3%", delta: "较 Q2 +0.7pt" },
            { label: "客户留存", value: "91.2%", delta: "历史新高" },
          ],
        },
        caption: { kind: "text", text: "数据口径：管理报表，未审计" },
      },
      notes: notes(topic, "三个核心指标", "三个指标同向改善，才说明是经营质量提升而不是会计口径变化。"),
      warnings: [],
    },
    {
      id: "s6",
      layout: "twocol",
      slots: {
        title: { kind: "text", text: "增长的两条腿：存量扩购与交付提效" },
        leftTitle: { kind: "text", text: "存量扩购" },
        leftBody: {
          kind: "bullets",
          items: ["头部 20 家客户贡献增量的 62%", "扩购品类集中在数据与合规模块", "续约周期从 12 个月拉长到 18 个月"],
        },
        rightTitle: { kind: "text", text: "交付提效" },
        rightBody: {
          kind: "bullets",
          items: ["自动化工单覆盖 78% 的标准请求", "人均交付项目数提升 21%", "交付周期缩短 6.5 天"],
        },
      },
      notes: notes(topic, "两条腿", "左栏是收入端，右栏是成本端，合起来解释毛利率为什么能提升。"),
      warnings: [],
    },
    {
      id: "s7",
      layout: "section",
      slots: {
        eyebrow: { kind: "text", text: "第二部分" },
        title: { kind: "text", text: "盈利结构：改善来自效率不是省钱" },
        subtitle: { kind: "text", text: "研发投入没有下降，人效反而提升" },
      },
      notes: notes(topic, "第二部分", "这一部分要打消「靠砍投入换利润」的质疑。"),
      warnings: [],
    },
    {
      id: "s8",
      layout: "data",
      slots: {
        title: { kind: "text", text: "营收逐季走高，毛利率同步改善" },
        chart: {
          kind: "chart",
          chart: {
            type: "bar",
            categories: ["第一季度", "第二季度", "第三季度"],
            series: [{ name: "营收（百万元）", values: [120, 138, 152] }],
          },
          insight: "营收与毛利率同向，说明增长没有依赖降价换量。",
        },
        insight: { kind: "text", text: "营收与毛利率同向改善，增长没有依赖降价换量。" },
        caption: { kind: "text", text: "数据口径：管理报表，单位为百万元" },
      },
      notes: notes(topic, "营收与毛利率", "柱状图只讲趋势，不要念数字；重点是两条线的方向一致。"),
      warnings: [],
    },
    {
      id: "s9",
      layout: "bullets",
      slots: {
        title: { kind: "text", text: "下一步：把可复制的部分固化成流程" },
        body: {
          kind: "bullets",
          items: [
            "把扩购触发条件写进客户成功 SOP，降低对个人经验的依赖",
            "自动化交付覆盖从 78% 推到 90%，优先攻高频低价值请求",
            "头部客户集中度风险需要单独设阈值预警",
          ],
        },
      },
      notes: notes(topic, "下一步", "三条都是可执行动作，不是口号；每条都要有负责人和时间点。"),
      warnings: [],
    },
    {
      id: "s10",
      layout: "closing",
      slots: {
        title: { kind: "text", text: "增长是结构性的，需要的是把它固化下来" },
        subtitle: { kind: "text", text: "谢谢，欢迎提问" },
        footer: { kind: "text", text: "战略与运营中心 · 2026 年 10 月" },
      },
      notes: notes(topic, "收尾", "回到开场的那句结论，形成闭环，然后停下来等提问。"),
      warnings: [],
    },
    {
      id: "s11",
      layout: "image",
      slots: {
        title: { kind: "text", text: "附录：交付流程改造前后的对比" },
        image: { kind: "image", src: null, alt: "流程对比示意图" },
        body: {
          kind: "text",
          text: "改造前：每个项目独立排期，标准请求与定制请求混在一起处理。改造后：标准请求进入自动化通道，定制请求集中到专家池。",
        },
        caption: { kind: "text", text: "示意图为纯图形占位，未使用外部素材" },
      },
      notes: notes(topic, "附录", "这一页放在最后，只在被追问时翻出来讲，不占主线时间。"),
      warnings: [],
    },
  ];

  // 页序：保证「10 页」这一默认长度下仍然覆盖全部 8 种版式，
  // 结尾页永远在最后，多出来的页（附录/下一步）插在结尾之前。
  const ORDER = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s11", "s9", "s10"];
  const byId = new Map(all.map((s) => [s.id, s]));
  const canonical = ORDER.map((id) => byId.get(id)).filter((s): s is Slide => Boolean(s));
  const closing = canonical[canonical.length - 1];
  const bodySlides = canonical.slice(0, -1);

  let slides: Slide[];
  if (count <= 1) {
    slides = [canonical[0]];
  } else if (count >= canonical.length) {
    slides = canonical;
  } else {
    slides = [...bodySlides.slice(0, count - 1), closing];
  }

  return {
    schemaVersion: "1.0",
    meta: {
      title: topic,
      size: "16:9",
      templateId: theme.id,
      themeId: theme.id,
      locale: "zh-CN",
      createdAt: now(),
      updatedAt: now(),
    },
    theme: theme.tokens,
    slides,
  };
}

/** 8 种版式各一页，供版式回归测试用 */
export function buildLayoutCoverageDeck(themeId = "business-navy"): Deck {
  const theme = getTheme(themeId);
  const sample: Record<string, Record<string, SlotContent>> = {
    cover: {
      eyebrow: { kind: "text", text: "示例" },
      title: { kind: "text", text: "版式覆盖：封面" },
      subtitle: { kind: "text", text: "用于回归测试" },
      footer: { kind: "text", text: "内部" },
    },
    toc: {
      title: { kind: "text", text: "版式覆盖：目录" },
      body: { kind: "bullets", items: ["第一条", "第二条", "第三条"] },
    },
    section: {
      eyebrow: { kind: "text", text: "章节" },
      title: { kind: "text", text: "版式覆盖：章节页" },
      subtitle: { kind: "text", text: "一句话说明" },
    },
    bullets: {
      title: { kind: "text", text: "版式覆盖：要点页" },
      body: { kind: "bullets", items: ["要点一", "要点二", "要点三"] },
    },
    twocol: {
      title: { kind: "text", text: "版式覆盖：双栏对比" },
      leftTitle: { kind: "text", text: "左" },
      leftBody: { kind: "bullets", items: ["左一", "左二"] },
      rightTitle: { kind: "text", text: "右" },
      rightBody: { kind: "bullets", items: ["右一", "右二"] },
    },
    image: {
      title: { kind: "text", text: "版式覆盖：图文页" },
      image: { kind: "image", src: null, alt: "占位" },
      body: { kind: "text", text: "左侧为图片占位，右侧为正文说明。" },
      caption: { kind: "text", text: "图注" },
    },
    data: {
      title: { kind: "text", text: "版式覆盖：数据页" },
      chart: {
        kind: "chart",
        chart: {
          type: "bar",
          categories: ["A", "B", "C"],
          series: [{ name: "数量", values: [3, 5, 8] }],
        },
      },
      caption: { kind: "text", text: "数据来源：回归测试" },
    },
    closing: {
      title: { kind: "text", text: "版式覆盖：结尾页" },
      subtitle: { kind: "text", text: "谢谢" },
      footer: { kind: "text", text: "内部" },
    },
  };

  const slides: Slide[] = LAYOUT_IDS.map((id, i) => ({
    id: `cov-${id}`,
    layout: id,
    slots: sample[id] ?? {},
    notes: `第 ${i + 1} 页：${id} 版式回归测试用备注，长度需要超过八十个字以满足备注预算要求，这里继续补充文字直到达标为止，确保断言可以稳定通过而不是偶然通过。`,
    warnings: [],
  }));

  return {
    schemaVersion: "1.0",
    meta: {
      title: "版式覆盖测试",
      size: "16:9",
      templateId: theme.id,
      themeId: theme.id,
      locale: "zh-CN",
      createdAt: now(),
      updatedAt: now(),
    },
    theme: theme.tokens,
    slides,
  };
}
