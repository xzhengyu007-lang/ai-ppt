# C 线调研：内容与版式分离（只借设计，不走 HTML 导出）

> 调研员：research-separation ｜ 日期：2026-11-09（墙钟）
> 范围：从成熟项目里抄「Theme / Layout / Content 如何解耦」的设计；**不用于**「拿一个能生成幻灯片的项目来用」。
> 铁律执行：下方每一个 star / license / 最近提交 / issue 编号，均来自本轮真实 `gh api` / `gh issue list`（命令见 §6）。
> 所有结论只引用本仓**实测**数据；取不到的写 `未核实`（见 §5）。

---

## 1. 候选实测表

路径一栏为**建议落地位置**（本项目阶段 0，目录尚未固化，故标 `（拟建）`）。

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件 | 坑 |
|---|---|---|---|---|---|---|---|
| **tw93/Kami** | 12431 | MIT | 2026-11-08 | HTML | **本线唯一「IR + token + 多渲染器」全齐的样本**：`schemas/slides.json`（内容契约 + 逐字段字数预算）、`references/tokens.json`（16 个颜色 CSS 变量）、`checks_thresholds.json`（可量化的密度/孤字/节奏阈值）、`assets/templates/slides.py`（python-pptx 渲染器）、`slides-weasy.html`（WeasyPrint/PDF 渲染器）、`assets/templates/marp/*`（第三个 Marp 渲染器） | `src/ir/slide-ir.schema.json`（拟建，抄其 `maxLength` 预算思路）；`src/theme/tokens.json`（拟建）；`src/render/pptx/`（拟建）；`src/render/dom/`（拟建）；`src/estimate/text-metrics.ts`（拟建）；`docs/已知差异.md` | **① 它的 token 是「双写」的**：`tokens.json` 只写 CSS 变量名，而 `slides.py` 把同一批颜色**硬编码**成 `RGBColor(...)` 常量 —— 一份规则并没有真正被两个渲染器共享，是人工抄的。**② 同一套 deck，PDF 页是 `280mm×158mm`（比例 1.7722），PPTX 却是 `13.33in×7.5in`（1.7777）**，两个目标各自重新排版、比例差 0.3%。**③ 同一 class `.co` 在 WeasyPrint 里 `bottom:12mm`、在 Marp 主题里 `bottom:18mm`**（Kami `design.md` 自述：因为 Marp 自带 footer 在 `bottom:10mm` 全宽）。这就是「同一规则多目标」的真实成本 |
| **hugohe3/ppt-master** | 74872 | MIT | 2026-11-08 | Python | 原生 pptx 生成（native shapes/charts/tables）+ 自带 .pptx 模板抽取。**对本线最大的价值不是架构，而是 issue 里那份「文字宽度估算误差」的实测清单** | `src/estimate/text-metrics.ts`（拟建，直接采用其 fudge 系数）；`docs/已知差异.md` | **① 它证明了「估算器算窄 → 文字溢出」是这条路线最典型的翻车点**（#199）。**② 74.8k star 但 open issue 仅 1 个**，仓库极新（2025-12-10 建），issue 讨论生态薄，架构结论不宜只靠它。**③ 中文 locale 会影响西文字体渲染**（#192），说明 pptx 的 `zh-CN` 语言标记不是无副作用的 |
| **marp-team/marp-core** | 1165 | MIT | 2026-10-20 | TypeScript | Marp 真正的引擎（`marp` 12.7k 只是入口仓；`marpit` 1394 才是主题/directive 框架）。**Q1/Q2 的对照基准**：theme = 单个 CSS 文件 + `/* @theme name */` + `@size` 元数据 | 无（设计对照，不落地） | **① 槽位抽象几乎为零**：全库唯一的版式钩子是 `<!-- _class: lead -->` → `<section class="lead">`，本质是一个**裸 CSS 类名**，主题必须预先知道它；`header`/`footer` 是仅有的两个命名区域且只能放文本，没有几何。**② 没有字数预算**。**③ `@size` 是「一主题一尺寸」**，不能用 inline style/class/CSS 变量改（marpit `theme-css.md` 明文）。**④ 主题定制长期靠 Sass 变量，直到 #209 才迁到 CSS 变量，作者自己标注「会让已有幻灯片外观破掉，必须是 major 更新」** |
| **slidevjs/slidev** | 49400 | MIT | 2026-11-05 | TypeScript | 版式抽象最细的一档：`packages/client/layouts/` 下 **21 个 `.vue` 版式组件**，`two-cols.vue` 同时开放 default slot + `left` + `right` 命名槽，内容用 markdown 的 `::right::` 切分 | 无（设计对照，不落地） | **① layout 是「可执行的 Vue 组件」，只有 DOM 渲染器能消费**——它不产出任何几何数据，所以第二个渲染器（pptx）拿不到槽位坐标。**② 没有字数预算**，覆盖/溢出只能靠人眼。**③ `pptx-editable` 导出靠解析 DOM，已证有损**（#2797 `counter()` 被写成字面量 `counter(step)`）。**④ 命名槽在导出时会消失**（#2588） |
| **sivan/heti** | 6749 | MIT | 2025-08-31 | SCSS | **中文排版规则的唯一可直接取用的实现**：`js/heti-addon.js` 里中西文混排与全角标点挤压的**纯正则**判定；`lib/helpers/_add-on.scss` 里**精确到 em 的挤压量**。不依赖 DOM 即可复现判定逻辑 | `src/estimate/cjk-spacing.ts`（拟建，移植其正则与 em 量）；`docs/已知差异.md` | **① 挤压/混排是 JS 实现的，pptx 里没有对应物**，只有「插入位置」可迁移，「视觉结果」不可。**② `heti-adjacent-half` 在 Chrome 上是错的**（#124，与现代浏览器原生 `text-spacing-trim` 叠加），作者用 `text-spacing-trim: space-all` 反向关掉原生挤压规避。**③ 包裹 inline 元素会让 `text-align:center` 失效**（#108）——我们的 DOM 渲染器标题大量居中，不能直接套 heti。**④ 项目自 2025-08 无提交**，README 自称「暂时没什么想做的了」，属**功能完备但停止演进**，规则可信、不要指望修 bug |

补充观察（非主干，不进上表）：

| 仓库 | stars | license | 最近提交 | 语言 | 结论 |
|---|---|---|---|---|---|
| hakimel/reveal.js | 72537 | MIT | 2026-09-30 | JavaScript | 纯 CSS/`data-*`，**没有 layout 概念**（只有 `<section>` 内容流）；主题是 Sass 变量编译成 `--r-*` CSS 变量（`css/theme/black.scss` 用 `@use 'template/settings' with (...)`）。对我们只提供「CSS 变量命名法」这一条参考 |
| marp-team/marp | 12731 | MIT | 2026-11-07 | TypeScript | 生态入口仓，本身不含引擎 |
| marp-team/marpit | 1394 | MIT | 2026-11-01 | JavaScript | 主题/directive 的真正框架，Q1/Q2 的设计都出自这里 |
| marp-team/marp-cli | 3909 | MIT | 2026-09-08 | TypeScript | 导出侧。**官方 README 自述**：`--pptx` 产出的 pptx「usually consists of pre-rendered background images, that is meaning contents cannot to modify or re-use」；另有实验性 `--pptx-editable`，但要求同时安装浏览器 + LibreOffice Impress，且官方明言「**无法保证外观，不建议在意外观时使用可编辑 pptx**」 |

---

## 2. 六个必答问题

### Q1 · theme token 机制：三层划分和 PowerPoint 母版模型是否真的一一对应？

**各家实测的主题表达方式：**

| 项目 | token 载体 | 可运行时改？ | 证据 |
|---|---|---|---|
| Marpit / Marp | **CSS 文件**，`/* @theme name */` 注释即元数据；颜色靠 Sass 变量 | 改颜色需 Sass 编译（v3/v2 起才迁到 CSS 变量） | `marpit/docs/theme-css.md`；`marp-core/themes/gaia.scss` 里 `$color-primary: #0288d1` |
| Slidev | Vue 组件 + UnoCSS 类；字体/颜色走 CSS 变量与 `fonts.*` 配置 | 是（但字体粒度已被吐槽） | `layouts/*.vue`；#2764 |
| reveal.js | **Sass 变量** `@use 'template/settings' with (...)` → 编译出 `--r-*` | 否（编译期） | `css/theme/black.scss` |
| Kami | **扁平 CSS 变量表** `references/tokens.json`（16 项，纯颜色）+ `design.md` 里的散文规则 + `slides.py` 里硬编码常量 | HTML 侧是；pptx 侧否 | `tokens.json`、`slides.py` |

**判断：三层划分在「结构」上成立，在「能力边界」上不成立 —— 不能假设一一对应。**

1. **结构确实同构。** PowerPoint 自身就是 母版(theme) → 版式(layout) → 幻灯片(content) 三层，和我们 Theme → Layout → Content 对得上。Kami 的 `schemas/slides.json` 也是这个分层（theme 在 CSS、layout 是 `layout` 枚举、content 是字段）。**所以这个划分可以保留。**
2. **但 ppct 的 theme 装不下我们的 Theme。** pptx 的 `theme1.xml` 只有 `clrScheme`（dk1/lt1/dk2/lt2 + 6 个 accent + 2 个 hyperlink）和 `fontScheme`（major/minor 两族）。我们的 Theme 里的**「间距节奏」和「圆角描边规则」在 pptx theme 层没有任何落点**，只能被吸收进 layout 的占位符几何或每个 shape 的属性。Kami 就是明证：它有 `--rhythm-module:16pt` / `--rhythm-section:22pt` 两个节奏 token（在 CSS 里），而 `slides.py` 里**根本没有节奏 token，全是 `Inches()` 字面量**。
3. **字数预算在 pptx 里没有对应物。** 那是纯 IR 层概念，两个渲染器都必须服从、但只有我们的估算器能执行。
4. **Kami 干脆绕开了母版。** `slides.py` 用 `prs.slide_layouts[6]`（Blank）+ 绝对 `Inches()` 坐标画所有形状，**完全不使用 pptx 的 master/layout/placeholder**。这说明实务上，要「几何可预测」就得放弃 PowerPoint 的「换母版全篇重排」能力——这是一个必须显式做出的取舍。

**别人踩过的「换主题破版」：**

- **marp-core #209**：把内置主题从 Sass 变量迁到 CSS 变量时，作者原话是「**this migration may make broken the look of exist Marp slides so this change must be the major update**」。→ 主题 token 迁移本身就是破版源。
- **reveal.js #3895**：v6 的 dracula 主题背景色变了（主题值不稳定）。
- **Kami #34**：同一份 HTML，WeasyPrint 63.1 与仓库自带参考 PDF 不一致（flex `margin-left:auto` 失效 + 内嵌 CJK 字体被 Quartz 替换成系统黑体，替换后字更宽导致**重叠**）。
- **Kami `design.md` 自述**：`.co` 在 WeasyPrint 用 `bottom:12mm`，在 Marp 主题里必须改 `bottom:18mm`——**同一个语义槽位，跨渲染器值不同**。

> **对本项目的动作**：Theme 必须显式拆成两半——`theme.pptx`（能进 `clrScheme`/`fontScheme` 的颜色与字体）与 `theme.layout`（被渲染器吸收的间距/圆角/描边/预算）。不要幻想一份 Theme 全量映射到母版。

---

### Q2 · layout 槽位抽象：有没有「命名槽位 + 字数预算」的先例？

**有，而且只有 Kami 一家同时具备两者。**

| 项目 | 抽象到哪一层 | 命名槽位 | 字数预算 | 几何数据 |
|---|---|---|---|---|
| Marpit / Marp | `<section>` 的 CSS 类名（`<!-- _class: lead -->`） | ❌ 只有裸类名 | ❌ | ❌（几何在 CSS 里） |
| Slidev | Vue 组件 + `<slot>` | ⚠️ 部分：`two-cols` 等少数版式开放 `left`/`right`；`cover.vue` 只有一个 `<slot />` | ❌ | ❌（UnoCSS `grid-cols-2`） |
| reveal.js | 无版式概念，`data-background-*` 只作用于背景 | ❌ | ❌ | ❌ |
| **Kami** | **JSON Schema 的 `layout` 枚举 + 逐字段 `maxLength`** | ⚠️ 字段即槽位（`title`/`eyebrow`/`items`/`chart`/`cap`） | ✅ **有，且是硬约束** | ⚠️ 在渲染器代码里，不在 schema 里 |

Kami `schemas/slides.json` 实测的字数预算（这是本线最有价值的单条证据）：

```
title 2–80  ·  subtitle ≤120  ·  audience 4–160  ·  slides 5–40
layout enum: [cover, chapter, content, quote, metrics, close]   ← 6 种
eyebrow ≤40  ·  slide.title 2–110
items: maxItems 5, 每项 4–110；注释写「3–5 条，每条必须放一行；不足 3 条且无图表就并入相邻页」
chart: {kind 2–40, insight 6–160}
cap ≤200
```

**12 套主题 × 8 版式，哪种组织方式维护成本最低？**

按实测的三种组织方式算一下最坏情况：

- **Marp 式（版式 = CSS 类名）**：8 个版式只能写成 12 个主题文件里的 8 组选择器 → **12 × 8 = 96 处**，且无槽位、无预算，改一处要翻 12 个文件。
- **Slidev 式（版式 = 可执行组件）**：8 个版式组件 + 12 个主题包 → **8 + 12 = 20 个产物**，成本低；但组件是代码，**第二个渲染器无法复用**，等于 pptx 侧要再写一遍。
- **Kami 式（版式 = schema 枚举，渲染逻辑在渲染器里）**：schema 里 1 处枚举，但**每个渲染器各实现一遍** → PDF 6 版式 + pptx 6 版式 + Marp 6 版式 = **18 处**，正是它 `.co` 12mm/18mm 漂移的原因。

> **结论（推荐）**：主题与版式是**正交轴**，不要相乘。把 Layout 做成**数据记录**（`slots: [{id, x,y,w,h, maxChars, maxLines, role}]`）放进 IR，而不是 CSS 类名、不是 Vue 组件、不是渲染器里的函数。这样成本是 **12 + 8 = 20 个产物**，且两个渲染器消费同一份槽位几何。Slidev 证明了「组件化版式」的成本可以接受，Kami 证明了「字数预算写进 schema」可行——**两者结合，但把槽位几何从代码里搬到数据里**，这是我们相对所有候选的改进点。

---

### Q3 · 16:9 几何口径

**最关键的实测发现：Kami 的 pptx 用的就是我们的口径。**

```python
# skills/kami/assets/templates/slides.py
SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)
```

13.33in × 96 = **1279.7 px ≈ 1280 px**；7.5in × 96 = **720 px**。即 **13.3333in × 7.5in ≡ 1280×720 px @96dpi**，与我们的规格完全一致，`px↔inch` 一律 `/96` 是对的。这也说明 1280×720@96 是 PowerPoint 16:9 宽屏的标准口径，不是我们自创。

**各家几何处理：**

| 项目 | 画布声明 | 缩放做法 |
|---|---|---|
| Marpit | `section { width:1280px; height:720px }`（默认值）；`@size 16:9 1280px 720px`、`@size 4:3 960px 720px` 写在主题元数据里 | **容器内 `rem` 重定基**：`:root` 指每个 `<section>` 而非 `<html>`，`rem` 自动按 section 的 `font-size` 换算——这样嵌到任意页面都等比。**不是** `transform: scale` |
| Marp（引擎内） | 同上 | `@auto-scaling true` + Web Component `::part(auto-scaling)`，给 `h1` 设 `max-height:580px`（= 720 − 40×2 padding）做「装不下就缩字号」。**按内容溢出缩字号，不是整体缩放** |
| Kami（PDF） | `@page { size: 280mm 158mm }`，`padding: 16mm 20mm` | 印刷单位 mm |
| Kami（PPTX） | `Inches(13.33) × Inches(7.5)`，Blank 版式 + 绝对坐标 | 无缩放，直接用 inch |
| Slidev / reveal | 浏览器视口 | reveal 用对外层容器等比缩放 |

**可抄的做法：**
1. **`rem` 重定基**（Marpit）：把 `:root` 语义绑到「幻灯片容器」而不是文档根，内部一切长度用 `rem`/`em`，容器只有一处 `font-size` 决定整体缩放。这是 DOM 渲染器最省事的等比方案，比 `transform: scale` 更不容易出亚像素模糊。
2. **内容区高度显式算出**：Kami 的 `max-height: 580px = 720 − 40(上padding) × 2` 说明「可用内容高度」必须是一个显式 token，直接喂给估算器。
3. **不要跨目标复刻绝对几何**：Kami 的 PDF 是 280×158mm、PPTX 是 13.33×7.5in，比例差 0.3%，同一版式要重排两次。→ 我们的 IR 只存**归一化槽位**（相对 1280×720 的比例或 px），由各渲染器换算，绝不存 mm/in。

---

### Q4 · 中文排版：heti 解决了什么，pptx 里能迁移多少

**heti 实际解决的问题（读源码得到，不是读 README）：**

1. **中西文自动间距**（`js/heti-addon.js`）。判定是**纯正则**，可脱离 DOM 复现：
   ```js
   CJK = \u2e80-\u2eff \u2f00-\u2fdf \u3040-\u309f \u30a0-\u30fa \u30fc-\u30ff
         \u3100-\u312f \u3200-\u32ff \u3400-\u4dbf \u4e00-\u9fff \uf900-\ufaff
   A   = A-Za-z \u0080-\u00ff \u0370-\u03ff      // 拉丁
   N   = 0-9
   S   = `~!@#$%^&*()-_=+[]{}\|;:'",<.>/?
   ANS = A N S
   // 三种位置：CJK+ANS+CJK / 行首 ANS+CJK / CJK+ANS+行尾
   ```
   **宽度实测**（`lib/helpers/_add-on.scss`）：`.heti-spacing-start { margin-inline-end: 0.25em }`、`.heti-spacing-end { margin-inline-start: 0.25em }` → **两侧各 0.25em**。

2. **全角标点挤压**。分四档，实测挤压量：
   ```scss
   .heti-adjacent-half    { margin-inline-end: -0.5em;  }   // 压半个字
   .heti-adjacent-quarter { margin-inline-end: -0.25em; }   // 压四分之一个字
   ```
   判定集（源码里的字符类）：停顿 `。．，、：；！‼？⁇` ｜ 分隔 `·・‧` ｜ 开 `「『（《〈【〖〔［｛` ｜ 闭 `」』）》〉】〗〕］｝` ｜ 半角弯引号 `“”‘’`。
   - **半字压缩**：停顿→开/闭、开→开、闭→闭
   - **四分之一压缩**：分隔→开、闭→分隔、停顿→弯引号、弯开→开

3. **反向规避原生挤压**：`heti-adjacent { text-spacing-trim: space-all; unicode-bidi: isolate; }` —— 主动关掉浏览器原生的 `text-spacing-trim`，否则两套挤压叠加（这就是 #124 的根因）。

4. **行高/字号**：`$font-size-normal: 16px`、`h1: 32px`、`h2: 24px`；字重 `400/600/800`。**heti 本身不提供避头尾实现**——它依赖浏览器默认 kinsoku（只在 #91 里提出「行末标点也挤压」的诉求）。

5. 另外还提供：贴合网格排版、古文/诗词版式、行间注（ruby）、多栏、竖排、简繁支持、暗色模式。

**迁移到 .pptx 的可迁移性 —— 逐条判定：**

| heti 能力 | 能否迁移到 pptx | 理由 |
|---|---|---|
| 中西文间距的**插入位置判定** | ✅ **能** | 纯正则，与渲染器无关。可算进估算器：命中处宽度 `+0.25em` |
| 中西文间距的**视觉结果** | ❌ | pptx 无 CSS margin；只能靠插入半角空格或调整字距凑，且会被 PowerPoint 的「中英文间自动加空格」选项干扰 |
| 标点挤压的**判定与挤压量** | ✅ **能（作为规则）** | 判定集与 −0.5em/−0.25em 是确定的 → 估算器可将该字形前进宽度按 0.5/0.75 em 计数 |
| 标点挤压的**执行** | ❌ | pptx 无 `text-spacing-trim`，也无对应段落属性；PptxGenJS 未暴露。只能不改字、改宽度估算 |
| 行高 | ✅ **能** | ppct 段落有精确行距（`line_spacing` pt 或倍数） |
| 避头尾 (kinsoku) | ❌ | 无对应控制 → **已知差异** |
| `hanging-punctuation: allow-end` | ❌ | 仅 WebKit |
| ruby/竖排/多栏 | ⚠️ 部分 | pptx 无原生 ruby；竖排需 `vert` 文本方向，多栏需自己切 shape |

> **一句话**：heti 里**能进 IR 的是「哪里要加间距/挤压」和「加多少 em」，不能进的是「谁来执行」**。所以它必须被拆成「估算器规则」+「已知差异」两张表。

---

### Q5 · 为什么 marp / slidev 不能当主路线（具体到能做什么、缺什么）

**Marp / Marpit**
- 能做：Markdown 一写多出（HTML / PDF / PNG / PPTX），主题是有明确元数据的 CSS 文件，`rem` 重定基做等比，`auto-scaling` 处理标题溢出，生态成熟（marp 12.7k star）。
- 缺什么：
  1. **`--pptx` 导出是位图** —— **已由 marp-cli 官方 README 实证**：「A converted PPTX usually consists of pre-rendered background images, that is meaning **contents cannot to modify or re-use** in PowerPoint.」直接违背本项目第一需求。
  2. **实验性 `--pptx-editable` 也救不了**，官方自己把三条限制写在 README 里：①「requires installing both of the browser and **LibreOffice Impress**」；②「If the theme and inline styles are providing complex styles into the slide, **`--pptx-editable` may throw an error or output the incomplete result**（e.g. `gaia` theme in Marp Core）」；③「Conversion to the editable PPTX results in **lower slide reproducibility** … **presenter notes are not supported**. **We do not recommend to export the editable PPTX if maintaining the slide's appearance is important.**」→ 即「可编辑」与「版式稳定」在 Marp 里是**互斥**的，而这两条正是我们的硬需求。
  3. **版式钩子只有 `class` 一个裸类名**，没有命名槽位、没有字数预算、没有槽位几何 → 承载不了 12×8。
  4. **`@size` 一主题一尺寸**，不能在单页改尺寸。
  5. 主题 token 直到 #209 才从 Sass 变量迁到 CSS 变量，且迁移本身被作者判定为破版级变更（major）。
- 结论：**可抄其 `rem` 重定基与 `@size` 元数据思路，不可当其为主路线。**

**Slidev**
- 能做：21 个版式组件、命名槽位、Vue 组件级扩展性、开发者体验最好（49.4k star）。
- 缺什么：
  1. **layout 是可执行 Vue 组件，只产出 DOM，不产出几何** → 第二个渲染器（pptx）拿不到槽位坐标，等于版式要重写一遍。
  2. **没有字数预算**，溢出靠人眼。
  3. **`pptx-editable` 导出靠解析 DOM，已证有损**：#2797 里 `counter()` 被原样写成字面量 `counter(step)` 盖在正文上；#2588 命名槽里的 `<img>` 在单文件 PDF 导出中消失。
  4. 字体 token 粒度不足（#2764 要求把 body 字体从 `font-sans` 解绑）。
- 结论：**可抄其「版式 = 组件 + 命名槽」的抽象粒度，不可抄其「版式即代码」。**

**reveal.js**
- 能做：极稳的 HTML 演示运行时（72.5k star、2011 年起）。
- 缺什么：**根本没有 layout 层**（只有 `<section>` 内容流 + 背景属性），主题是编译期 Sass。对我们无版式参考价值。

**为什么否决 HTML 路线（一句话）**：HTML 路线的终点是「像素」——Marp 的 pptx 是每页图片，Slidev 的 editable-pptx 靠反解 DOM 且有损（#2797 把 `counter()` 写成字面量）；而我们要的是**文字可编辑的原生 pptx**，所以内容必须从一开始就活在我们的 IR 里，由 PptxGenJS 直接写 DrawingML，HTML 只能作为**预览**而不是**事实源**。

> 附带一个方法论提醒：`reveal.js #3914` 与 `slidev #2637`（标题均为「Editable PPTX from exported slide images or screenshots」）是**同一个账号同日跨仓发布的推广贴**，正文都在推销同一个项目 `slide-alchemy`，**不是真实用户缺陷报告**。本轮不把它们当作任何论据。

---

### Q6 · 每个主干参考的 ≥2 个真实 issue

> 全部编号经 `gh api repos/OWNER/REPO/issues/N` 逐个核实存在（见 §6）。

**Kami**
1. [#34](https://github.com/tw93/Kami/issues/34)（closed）模板在新版 WeasyPrint (63.1) 下排版回归：flex `margin-left:auto` 右对齐失效；内嵌 CJK 字体在 Quartz/预览下被替换成系统黑体，替换后字更宽造成**重叠**。
   → **影响**：证明「同一份源 + 换渲染器/换查看器 = 破版」是常态。我们的 pptx 渲染器不做字体内嵌，字宽会随查看者系统字体变化 → 估算器必须留余量，且**字体缺失必须降级可控**。
2. [#6](https://github.com/tw93/Kami/issues/6)（closed）19MB 内嵌字体（`TsangerJinKai02-W04.ttf`）导致 AI 环境超时。
   → **影响**：中文字体体积是工程约束。我们若内嵌/分发中文字体，必须做子集化（Kami 自己在 `design.md` 里给出的做法是 `pyftsubset` + `unicode-range`）。

**ppt-master**
1. [#199](https://github.com/hugohe3/ppt-master/issues/199)（closed）原生 pptx 在 LibreOffice 转 PDF 时文字换行/溢出：转换器**忽略 letter-spacing**，且用 **0.55em 平均字宽**低估了 Georgia/serif 大写字母宽度。已验证修法：`letter-spacing` 逐字累加 `ls_px × (len−1)`，并加 serif 感知余量 `single_line_fudge = 1.40 if serif else 1.18`。
   → **影响**：**这是本线最有价值的一条**，直接等于我们估算器的三个常量：`0.55em` 基线、`1.40/1.18` 余量、`ls × (n−1)` 累加。同时证明「框宽算窄」比「算宽」危险得多。
2. [#301](https://github.com/hugohe3/ppt-master/issues/301)（closed）转换成 PPTX 后不居中。
   → **影响**：文本框的「对齐锚点 vs 框位置」在 pptx 里容易错位；我们的槽位几何必须明确「对齐是相对槽位还是相对文本框」。
3. [#192](https://github.com/hugohe3/ppt-master/issues/192)（closed）生成的 PPTX 带 `zh-CN` locale，对拉丁字体不友好。
   → **影响**：pptx 的 `lang` 标记不是无副作用的，中文优先默认值会改变西文字体的渲染回退。

**marp-core**
1. [#209](https://github.com/marp-team/marp-core/issues/209)（closed）让内置主题可通过 CSS 变量定制。正文自述主题颜色原本是 Sass 变量，导致用户「为了改个颜色还得装 Sass 编译器」，并明确警告 **「这次迁移可能让现有 Marp 幻灯片外观破掉，必须是 major 更新」**。
   → **影响**：这是「换/迁主题就破版」最硬的证据。我们的 token 必须**从第一天就是数据**（JSON），而不是预处理器变量。
2. [#308](https://github.com/marp-team/marp-core/issues/308)（closed）内置主题中正文与 header/footer **内容重叠**。
   → **影响**：header/footer 作为「伪槽位」不参与正文排布计算就会重叠。我们的 Layout 必须把 header/footer/页码纳入同一套槽位几何与预算，而不是当作装饰。
3. [#402](https://github.com/marp-team/marp-core/issues/402)（closed）表格能否支持 auto-scaling。
   → **影响**：自动缩放只覆盖了标题和代码块，表格这类「内容尺寸不可预算」的元素没有兜底 → 我们的估算器必须覆盖表格，或明确禁止表格进模板。

**slidev**
1. [#2797](https://github.com/slidevjs/slidev/issues/2797)（open）`slidev export --format pptx-editable` 把 `::before { content: counter(step) }` 写成**字面量文本** `counter(step)`，叠在原文字上。
   → **影响**：DOM→pptx 的反解路线本质有损。我们**必须**让 IR 直接产出 pptx，而不是从 DOM 反推。
2. [#2588](https://github.com/slidevjs/slidev/issues/2588)（open）命名槽里的 `<img>` 在单文件 PDF 导出时、容器有 padding 的情况下消失。
   → **影响**：命名槽位在跨导出目标时不保证存活；槽位语义必须由 IR 定义，不能依赖渲染器的 DOM 结构。
3. [#2764](https://github.com/slidevjs/slidev/issues/2764)（open）请求新增 `fonts.body`，让正文字体不再绑死在 `font-sans` 上。
   → **影响**：字体 token 的粒度要按「角色」分（正文/标题/等宽），不能按「族」分。我们的字体对（中/西文）应再叠加角色维度。

**heti**
1. [#124](https://github.com/sivan/heti/issues/124)（open）`.heti-adjacent-half` 在 Chrome 上不应生效——与现代浏览器原生的 `text-spacing-trim` 叠加后挤压过度；提 issue 者的办法是用 `@-moz-document`/Safari-only 选择器把规则限定到 Firefox/Safari。
   → **影响**：**手动挤压与原生挤压会重复计算**。我们的 DOM 预览渲染器必须明确二选一（heti 源码里用 `text-spacing-trim: space-all` 关掉原生），否则预览与 pptx 的宽度口径不一致。
2. [#115](https://github.com/sivan/heti/issues/115)（open）使用 zh-Hant 字体时标题挤压不合预期：zh-Hant 的逗号句号是**居中**的，而 heti 一律往右压 0.5em，与其书写规范冲突；期望句号左右各压 0.25em。
   → **影响**：**标点挤压不是全中文一个值**，简繁不同。我们的规则表必须按 `zh-Hans` / `zh-Hant` 分开给值。
3. [#108](https://github.com/sivan/heti/issues/108)（open）用了 heti 样式后文字**无法居中**。
   → **影响**：heti 把文字包进 inline 元素，破坏 `text-align:center`。幻灯片标题大量居中 → **我们的 DOM 渲染器不能把 heti 当整体样式表套用**，只能取它的判定算法。

---

## 3. 本线结论

### 抄哪些设计

1. **Layout 必须是数据，不是代码**（改造自 Slidev + Kami）。槽位定义为 `{id, x, y, w, h, maxChars, maxLines, role}`，存进 IR。Slidev 证明了「组件化版式」好用但只能给一个渲染器用；Kami 证明了「字数预算进 schema」可行但几何留在代码里会漂移。**我们把几何也搬进数据** —— 这是相对所有候选的净改进，也是「12 主题 + 8 版式 = 20 个产物而不是 96 个」的前提。
2. **字数预算写进 JSON Schema**（抄 Kami `schemas/slides.json` 的 `maxLength` 手法）。它让「内容放不下」在**内容层**就被拦住，而不是等到渲染溢出。
3. **把可量化的排版阈值抽成单独 JSON**（抄 Kami `checks_thresholds.json`）。它是「规则可进 CI 单测」的直接证据：密度 25%/50%/末页 60%、孤字 ≤2 词/15 字符、连续内容页 ≤5、dpi 36 测量。
4. **token 从第一天就是 JSON 数据**（反 marp-core #209 的教训）：绝不引入 Sass/预处理器变量作为 token 的唯一来源。
5. **`rem` 重定基做等比**（抄 Marpit）：`:root` 语义绑到幻灯片容器，内部长度全用 `rem`/`em`，容器一处 `font-size` 决定整体缩放。比 `transform: scale` 更清晰，也不会引入亚像素模糊。
6. **内容区高度显式 token**（抄 Kami `max-height:580px = 720 − 40×2`）：估算器需要明确的可用高度，不能自己从 padding 反推。
7. **heti 的 CJK 判定正则 + 精确 em 量**（抄实现，不抄样式表）：中西文间距 0.25em、半字/四分之一挤压、字符集定义。这是唯一「可脱离浏览器执行」的中文排版资产。
8. **字体栈顺序规则**（抄 Kami，实测结论）：在 PDF / inline SVG 中 **CJK 族在前、拉丁族在后**，否则每个汉字单独 fallback、西文单词被劈成两种字体。
9. **`lining-nums tabular-nums`** 用于所有数字槽位（Kami 实测规则），保证 4:5:7:9 不下沉、数字等宽。
10. **中文 display 字号降一档**（Kami 实测：hero 标题 EN `96px` → CN `88px`）。中文字面更大，同字号观感更挤。

### 不抄什么

1. **不抄 Marp 的「版式 = CSS 类名」**：无槽位、无预算、无几何。
2. **不抄 Slidev 的「版式 = 可执行组件」**：只能服务一个渲染器，违反双渲染器前提。
3. **不抄 Kami 的「token 双写」**（`tokens.json` + `slides.py` 硬编码常量）：这正是我们要避免的漂移源。
4. **不抄 Kami 的「跨目标各自重排绝对几何」**（PDF 280×158mm vs PPTX 13.33×7.5in）：IR 只存归一化槽位。
5. **不抄 heti 的「整体样式表包裹」**：会破坏居中（#108），且与原生挤压叠加（#124）。只取判定算法。
6. **不抄 pptx 母版/占位符作为几何事实源**：Kami 用 Blank 版式 + 绝对坐标的做法说明，要几何可预测就得绕开母版继承。我们采用同样策略，但把几何放在 IR 里以便 DOM 渲染器共用。

### 为什么否决 HTML 路线

一句话：**HTML 路线的产物是像素，而我们要的是可编辑文字。**

具体到「它能做什么、缺什么」：
- Marp 能做 Markdown→PDF/PNG/HTML，`--pptx` 是**每页一张图**，文字不可编辑。
- Slidev 能做到最细的版式抽象（21 组件 + 命名槽），但 layout 是 DOM 组件、不产出几何，`pptx-editable` 靠反解 DOM 且已证有损（#2797 把 `counter()` 写成字面量）。
- reveal.js 连 layout 层都没有。

因此架构维持既定方案：**统一 Slide IR 为唯一事实源 → DOM 渲染器只做预览 → PptxGenJS 直接写 DrawingML 出可编辑 pptx**。HTML 只是预览的一个实现，绝不是事实源，也绝不是导出路径。

---

## 4. 可迁移的排版规则清单

> 这是本线交付的核心。分两张表：**A 表**能进 IR / 确定性估算器（可进 CI 单测）；**B 表**只能写进 `docs/已知差异.md`。
> 每条都标注来源。数值均为本轮实测，未实测的标注「推断」。

### A. 能进 IR / 估算器（确定性，可 CI 单测）

| # | 规则 | 具体数值 / 判定 | 来源 | 可测方式 |
|---|---|---|---|---|
| A1 | 中西文自动间距：**插入位置判定** | CJK 与 ANS 相邻处（含行首/行尾）插入间距 | heti `js/heti-addon.js` 正则 | 纯函数：给定字符串 → 返回插入点数组 |
| A2 | 中西文自动间距：**宽度** | 两侧各 `0.25em` | heti `_add-on.scss` `.heti-spacing-start/-end` | 断言总宽 = 基础宽 + 0.25em×命中数 |
| A3 | 全角标点挤压：**半字档** | `−0.5em`；适用：停顿→开/闭、开→开、闭→闭 | heti `_add-on.scss` `.heti-adjacent-half` | 表驱动单测 |
| A4 | 全角标点挤压：**四分之一档** | `−0.25em`；适用：分隔→开、闭→分隔、停顿→弯引号、弯开→开 | heti 同上 `.heti-adjacent-quarter` | 同上 |
| A5 | 标点字符集 | 停顿 `。．，、：；！‼？⁇`／分隔 `·・‧`／开 `「『（《〈【〖〔［｛`／闭 `」』）》〉】〗〕］｝`／弯引号 `“”‘’` | heti `heti-addon.js` | 常量表 |
| A6 | **简繁分开给挤压值** | zh-Hant 应为左右各 `0.25em`，不能统一右侧 `0.5em` | heti #115 | 参数化：`locale → 挤压表` |
| A7 | 字距必须计入宽度 | `width += ls_pt × (len − 1)`（letter-spacing 逐字累加） | ppt-master #199 | 断言含 letter-spacing 的串宽度增加 |
| A8 | **单行宽度余量** | `serif: ×1.40`、`sans: ×1.18` | ppt-master #199（已验证修法） | 回归测试：已知溢出样例必须判「溢出」 |
| A9 | 平均字宽基线 | 拉丁 `0.55em`（**对 serif 大写不足，须叠加 A8**） | ppt-master #199 | 同上 |
| A10 | 中文字符宽度 | `1.0em`（全角） | 推断（未见实测文档） | 标 `未核实-推断`，需实测校准 |
| A11 | 行高三档 | 紧标题 `1.1–1.3`／密排正文 `1.4–1.45`／阅读正文 `1.5–1.55` | Kami `design.md` 不变式 6 | 常量区间断言 |
| A12 | 幻灯片正文行高 | `1.55`（幻灯片），KO 文案 `1.45` | Kami `slides-weasy.html` / KO 调优节 | 同上 |
| A13 | 中文正文字距 | `0.3pt`；西文 `0` | Kami 不变式 7 + `design.md`「CJK 的关键是字距而非字号」 | 同上 |
| A14 | 字号阶梯（幻灯片） | 正文 13pt／`h2` 32pt w500／`h3` 18pt w500／眉标 10pt mono ls2pt／`lead` 16pt／module title 19pt／module letter 28pt／sub-label 9pt／body 13pt／item 13pt／cadence 11pt／callout 14pt bold／封面标题 44pt | Kami `design.md` 表格 | 枚举白名单：出现阶梯外字号即 fail（Kami 自己的「type ladder」原则） |
| A15 | 中文 hero 降档 | EN `96px` → CN `88px` | Kami `design.md` §11 | 常量表 |
| A16 | 间距节奏 token | 仅 2 个：`--rhythm-module: 16pt`、`--rhythm-section: 22pt` | Kami `slides-weasy.html` | 断言无节奏外的魔数 |
| A17 | 双栏间距 | `gap: 22pt` | Kami `.c2` | 常量 |
| A18 | **字数预算（内容契约）** | deck `title` 2–80／`subtitle` ≤120／`audience` 4–160／`slides` 5–40／`eyebrow` ≤40／页 `title` 2–110／`items` ≤5 且每项 4–110／`chart.insight` 6–160／`cap` ≤200 | Kami `schemas/slides.json` | JSON Schema 直接校验 |
| A19 | **条目数与单行约束** | 每页 3–5 条；每条必须单行；<3 条且无图表则并页 | Kami schema 注释 + 内容规则 | 断言 items∈[3,5] 且每条估算宽 ≤ 槽宽 |
| A20 | 结构节奏配额 | 连续内容页 ≤5；12 页以上每 4–6 页一个章节页；≥1 个 quote/metrics | Kami `checks_thresholds.json` `rhythm` | 序列断言 |
| A21 | **密度阈值** | 警告 `25%`／过疏 `50%`／末页 `60%`；以 `dpi 36` 渲染测量留白比 | Kami `checks_thresholds.json` `density` | 渲染后按像素统计（CI 可跑） |
| A22 | **孤字阈值** | `max_words: 2`、`max_chars: 15` | 同上 `orphan` | 对每段末行断言 |
| A23 | 版式枚举 | 建议 8 种对齐我们的需求；Kami 只给了 6 种（`cover/chapter/content/quote/metrics/close`），**缺目录、双栏对比、图文** | Kami `schemas/slides.json` | 枚举校验 |
| A24 | 几何口径 | `1280×720 px @96dpi` ≡ `13.3333in × 7.5in`；`px↔inch` 一律 `/96`；内容区高度显式化（`720 − padding×2`） | Kami `slides.py` + `marpit` 默认 `@size 16:9 1280px 720px` | 单元测试换算 |
| A25 | 字体角色拆分 | 字体 token 按角色分（正文/标题/等宽），不只按「中/西」族分 | slidev #2764 | schema 校验 |
| A26 | 数字槽位 | `lining-nums tabular-nums` | Kami `design.md` | 规则断言 |
| A27 | CJK 字体栈顺序 | PDF/inline SVG：CJK 族在前、拉丁族在后 | Kami `design.md` | 栈顺序断言 |

### B. 只能进 `docs/已知差异.md`（渲染器无法保证，或跨渲染器必然不同）

| # | 差异项 | 现象 / 原因 | 来源 |
|---|---|---|---|
| B1 | **避头尾（kinsoku）** | 浏览器默认 kinsoku 让收尾标点不上行首；**pptx 无对应可控属性**，PptxGenJS 未暴露 → 行首可能出现 `，` `。` | heti（依赖浏览器默认）；本轮未在 pptx 侧找到控制手段 |
| B2 | `hanging-punctuation: allow-end` | 仅 WebKit 支持；Chromium 忽略，pptx 无 | Kami `design.md` |
| B3 | **原生标点挤压与手动挤压叠加** | Chromium 131+ 原生 `text-spacing-trim` 与 heti 的 margin 重复计算；heti 用 `text-spacing-trim: space-all` 反向关闭 | heti #124 + `_add-on.scss` |
| B4 | **字体替换导致字宽变化** | pptx 落到查看者系统字体；CJK 被替换后更宽会造成重叠 | Kami #34（Quartz 替换） |
| B5 | **LibreOffice 忽略 `wrap="none"`** | 单行文本框在 LO 转 PDF 时仍按框宽换行 → 末尾字掉行 | ppt-master #199 |
| B6 | 可编辑 pptx 的 `counter()` 变字面量 | DOM 反解路线丢语义 | slidev #2797 |
| B7 | WeasyPrint 不支持 flex `margin-left:auto` | 右对齐失效（PDF 路径特有） | Kami #34 |
| B8 | WeasyPrint 不支持 SVG `fill="url(#gradient)"`、`marker-end` 的 `orient="auto"` 不旋转、SVG 内 CSS Grid | 需改用显式 `<path>` 画箭头 | Kami `design.md` SVG 约束 |
| B9 | 2×2 对齐须用 `<table>` 而非 CSS Grid | Grid 不保证跨单元行等高 | Kami `design.md` |
| B10 | 标签背景须实心 hex，不能用 `rgba` | WeasyPrint 渲染成双矩形 | Kami 不变式 8 |
| B11 | 印刷不用斜体 | 无 `font-style: italic` | Kami 不变式 10 |
| B12 | zh-Hant 标点应居中、左右各 0.25em | 与现行统一右侧 0.5em 冲突 | heti #115 |
| B13 | heti 包裹 inline 元素破坏 `text-align:center` | 居中标题不能整体套 heti | heti #108 |
| B14 | 中文字体体积 | 19MB 字体会拖垮加载；须子集化 + `unicode-range` | Kami #6 + `design.md` `pyftsubset` |
| B15 | pptx `lang` 标记影响西文字体回退 | `zh-CN` locale 下拉丁字体表现变差 | ppt-master #192 |
| B16 | 跨目标绝对几何不可复用 | 同一 deck PDF 280×158mm(1.7722) vs PPTX 13.33×7.5in(1.7777)，差 0.3% | Kami `slides-weasy.html` + `slides.py` |
| B17 | 同一语义槽位跨渲染器值不同 | `.co` 在 WeasyPrint `bottom:12mm`、在 Marp `bottom:18mm` | Kami `design.md` |
| B18 | **「可编辑」与「版式复现」互斥** | Marp 官方 README 自述：可编辑 pptx 的复现度低于常规 pptx，复杂主题（如 `gaia`）会报错或产出不完整结果，且不支持演讲者备注 → 我们没有这条互斥，因为 IR 直接算几何；但需在文档里记录「为什么我们能做到」 | marp-cli README |
| B19 | HTML→pptx 的导出链依赖外部重量组件 | `--pptx-editable` 需同时装浏览器 + LibreOffice Impress；LibreOffice 的渲染差异又会引入新坑（见 B5） | marp-cli README + ppt-master #199 |

---

## 5. 未核实项

按铁律，取不到或不掌握的一律列此，**不填猜测值**。

1. **`hugohe3/ppt-master` 的架构结论未核实**：74.8k star、仅 1 个 open issue，仓库 2025-12-10 才建；本轮只读 issue，**未读其 `skills/` 内部规则文件**，故表中「能拿到什么」仅基于仓库自述与 issue 内容，不代表已审计其实现。
2. **Kami 的 token 同步机制未核实**：`slides.py` 里颜色确为硬编码 `RGBColor(...)` 常量，`tokens.json` 确为 CSS 变量表；但**是否由 `scripts/tokens.py` 自动生成/校验，本轮未读该脚本**，故「双写」表述基于「两处字面值当前一致但分别存在」这一事实，同步机制未知。
3. **Kami `scripts/deliver.py` / `build.py` 的导出编排未读**：「一份规则多目标导出」的具体实现链路未审计，仅从 `design.md` 自述得知有三个渲染路径（WeasyPrint / python-pptx / Marp）且 Marp 主题是「a port, not a redesign」。
4. **中文字符宽度 1.0em（A10）为推断**：未见任何候选给出汉字前进宽度的实测表；需本项目实测校准。
5. **`sivan/heti` 维护状态**：最近提交 `2025-08-31`（距今天 14 个月），非 archived（`archived: False`），24 个 open issue，README 自称「暂时没什么想做的了」。**未核实**是否仍有维护者响应新 issue。规则本身可信，但**不应期待修 bug**。
6. **heti 是否提供避头尾实现**：源码中未见独立的 kinsoku 逻辑，判定其依赖浏览器默认。这是**基于未读到相关代码**的判断，非文档确认。
7. **Slidev 的 pptx 导出实现未读源码**：`--format pptx-editable` 的具体机制仅从 #2797 的报错行为推断为「解析 DOM 后转 shape」，未读 `slidev/packages/` 内导出代码。
8. **未实测**「12 主题 × 8 版式」用数据化槽位后的实际构建耗时/维护工时；§2-Q2 的「20 vs 96 个产物」是产物计数，不是工时测量。
9. **未核实**各候选在纯中文长文本下的实际断行质量（无跨项目对照测试）。

---

## 6. 原始命令与输出

全部命令在本会话真实执行。`pwsh` 在本会话可用，`win_bash` 不可用；`.ps1` 需经 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` 启动（直接跑会被执行策略拦）。

### 6.1 环境与鉴权

```powershell
PS> gh auth status
github.com
  ✓ Logged in to github.com account xzhengyu007-lang (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: github_pat_****
PS> gh --version
gh version 2.103.3 (2026-10-26)
PS> Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
2026-11-09T02:28:48+08:00
```

### 6.2 仓库实测（探针脚本，输出 TSV：repo/stars/license/pushed_at/language/archived/open_issues/created_at/description）

```powershell
PS> powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 `
      marp-team/marp marp-team/marp-core slidevjs/slidev hakimel/reveal.js sivan/heti marp-team/marp-cli
marp-team/marp        12731  MIT  2026-11-07T09:29:51Z  TypeScript  False  1   2018-03-25T12:47:38Z  The entrance repository of Markdown presentation ecosystem
marp-team/marp-core   1165   MIT  2026-10-20T17:51:15Z  TypeScript  False  11  2018-06-05T15:43:27Z  The core of Marp converter
slidevjs/slidev       49400  MIT  2026-11-05T06:29:21Z  TypeScript  False  203 2021-04-24T01:25:23Z  Presentation Slides for Developers
hakimel/reveal.js     72537  MIT  2026-09-30T19:38:13Z  JavaScript  False  932 2011-06-07T18:54:22Z  The HTML Presentation Framework
sivan/heti            6749   MIT  2025-08-31T14:42:22Z  SCSS        False  24  2020-02-11T12:46:51Z  赫蹏（hètí）是专为中文内容展示设计的排版样式增强…
marp-team/marp-cli    3909   MIT  2026-09-08T14:24:15Z  TypeScript  False  20  2018-08-09T09:22:36Z  A CLI interface for Marp and Marpit based converters

PS> powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 marp-team/marpit
marp-team/marpit      1394   MIT  2026-11-01T04:30:06Z  JavaScript  False  26  2018-03-17T19:19:58Z  The skinny framework for creating slide deck from Markdown

PS> powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 tw93/Kami hugohe3/ppt-master
tw93/Kami             12431  MIT  2026-11-08T04:51:41Z  HTML    False  0  2026-04-20T16:35:19Z  👩‍🚒 Good content deserves good paper. Layout rules and templates that let AI agents export PDF, PNG and editable PowerPoint.
hugohe3/ppt-master    74872  MIT  2026-11-08T10:38:28Z  Python  False  1  2025-12-10T06:54:33Z  AI turns documents or topics into real, native PowerPoint decks—…support for your own .pptx templates.
```

### 6.3 补充候选搜索

```powershell
PS> gh search repos "markdown slides" --limit 12 --json fullName,stargazersCount,description
[{"fullName":"BeWaterMyFriend7/Marp-Theme-UCAS","stargazersCount":99},
 {"fullName":"dadoomer/markdown-slides","stargazersCount":158},
 {"fullName":"arpitbbhayani/deckrun","stargazersCount":178}, …]   # 无更强候选，未纳入

PS> gh search repos "presentation framework" --limit 12 --json fullName,stargazersCount,description
[{"fullName":"hakimel/reveal.js","stargazersCount":72537},
 {"fullName":"impress/impress.js","stargazersCount":38153}, …]     # 无更强候选，未纳入

PS> gh search repos "chinese typography" --limit 15 --json fullName,stargazersCount,description
[{"fullName":"judasn/ChineseTypography-IDEA-Plugin","stargazersCount":76},
 {"fullName":"huijing/clreq-css","stargazersCount":3}, …]          # 无更强候选，sivan/heti 仍是中文排版首选
```

### 6.4 源码取证命令（关键片段）

```powershell
# Marpit 主题/directive 规范（Q1/Q2 的对照基准）
PS> gh api repos/marp-team/marpit/contents/docs/theme-css.md -H 'Accept: application/vnd.github.raw'
   → "The default size is 1280 x 720 pixels"; "it must define the static length in an absolute unit"
   → "@size 16:9 1280px 720px" 等价写法见 gaia.scss 头部
   → ":root … indicates each <section> elements … instead of <html>"（rem 重定基）

PS> gh api repos/marp-team/marpit/contents/docs/directives.md -H 'Accept: application/vnd.github.raw'
   → local directives: class / backgroundColor / color / background* / paginate / header / footer
   → 仅有的版式钩子：<!-- _class: lead --> → <section class="lead">

PS> gh api repos/marp-team/marp-core/contents/themes/gaia.scss -H 'Accept: application/vnd.github.raw'
   → /*! @theme gaia  @auto-scaling true  @size 16:9 1280px 720px  @size 4:3 960px 720px */
   → $color-light / $color-dark / $color-primary / $color-secondary   （Sass 变量，编译期）
   → h1::part(auto-scaling) { max-height: 580px; }  // = 720 - padding*2

# Kami：IR / token / 阈值 / pptx 渲染器
PS> gh api repos/tw93/Kami/contents/skills/kami/references/tokens.json -H 'Accept: application/vnd.github.raw'
   → {"--parchment":"#f5f4ed", "--brand":"#1B365D", "--near-black":"#141413", …} 共 16 项，纯颜色

PS> gh api repos/tw93/Kami/contents/skills/kami/references/schemas/slides.json -H 'Accept: application/vnd.github.raw'
   → layout enum: cover/chapter/content/quote/metrics/close
   → title 2-80, subtitle ≤120, slides 5-40, eyebrow ≤40, slide title 2-110,
     items maxItems 5 each 4-110, chart{kind,insight≤160}, cap ≤200

PS> gh api repos/tw93/Kami/contents/skills/kami/references/checks_thresholds.json -H 'Accept: application/vnd.github.raw'
   → rhythm{max_content_run:5, divider_min_deck_size:12}
     density{warn_pct:0.25, sparse_pct:0.50, last_page_pct:0.60, dpi:36}
     orphan{max_words:2, max_chars:15}  visual{dpi:110}
     social_cards{image_dpi:96, footer_gap_px:40, orphan_max_chars:3}

PS> gh api repos/tw93/Kami/contents/skills/kami/assets/templates/slides.py -H 'Accept: application/vnd.github.raw'
   → SLIDE_W = Inches(13.33); SLIDE_H = Inches(7.5)        // ≡ 1280×720 @96dpi
   → prs.slide_layouts[6]                                   // Blank 版式，绕开母版
   → PARCHMENT = RGBColor(0xf5,0xf4,0xed) …                 // 颜色硬编码，未读 tokens.json

PS> gh api repos/tw93/Kami/contents/skills/kami/assets/templates/slides-weasy.html -H 'Accept: application/vnd.github.raw'
   → @page { size: 280mm 158mm; }  --rhythm-module: 16pt;  --rhythm-section: 22pt;
     width:280mm; height:158mm; padding:16mm 20mm;  max-height:105mm

# heti：中文排版算法与精确 em 量
PS> gh api repos/sivan/heti/contents/js/heti-addon.js -H 'Accept: application/vnd.github.raw'
   → CJK/A/N/S/ANS 字符类；REG_CJK_FULL / REG_CJK_START / REG_CJK_END
   → REG_BD_STOP `。．，、：；！‼？⁇` · REG_BD_SEP `·・‧`
   → REG_BD_OPEN `「『（《〈【〖〔［｛` · REG_BD_CLOSE `」』）》〉】〗〕］｝`
   → heti-adjacent-half / heti-adjacent-quarter 两档

PS> gh api repos/sivan/heti/contents/lib/helpers/_add-on.scss -H 'Accept: application/vnd.github.raw'
   → .heti-spacing-start { margin-inline-end: 0.25em }
   → .heti-spacing-end   { margin-inline-start: 0.25em }
   → .heti-adjacent-half    { margin-inline-end: -0.5em }
   → .heti-adjacent-quarter { margin-inline-end: -0.25em }
   → heti-adjacent { text-spacing-trim: space-all; unicode-bidi: isolate; }

# Slidev：版式组件与槽位粒度
PS> gh api repos/slidevjs/slidev/contents/packages/client/layouts --jq '.[]|.name'
   → 404/center/cover/default/end/error/fact/full/iframe*/image*/intro/none/quote/
     section/statement/two-cols-header/two-cols       共 21 个 .vue
PS> gh api repos/slidevjs/slidev/contents/packages/client/layouts/two-cols.vue -H 'Accept: application/vnd.github.raw'
   → <slot /> + <slot name="left" /> + <slot name="right" />；markdown 用 ::right:: 切分
PS> gh api repos/slidevjs/slidev/contents/packages/client/layouts/cover.vue -H 'Accept: application/vnd.github.raw'
   → 只有一个 <slot />（无命名槽）

# reveal.js：主题 = Sass 变量 → --r-* CSS 变量
PS> gh api repos/hakimel/reveal.js/contents/css/theme/black.scss -H 'Accept: application/vnd.github.raw'
   → @use 'template/settings' with ($background-color:#191919, $main-font:…, $main-font-size:42px, …)
PS> gh api repos/hakimel/reveal.js/contents/css/reveal.scss -H 'Accept: application/vnd.github.raw' | Select-String '--r-'
   → --r-controls-spacing / --r-overlay-* / --r-link-color …

# marp-cli README：实证「pptx = 位图」与「可编辑 pptx 的官方免责声明」
PS> gh api repos/marp-team/marp-cli/contents/README.md -H 'Accept: application/vnd.github.raw'
   → "A converted PPTX usually consists of pre-rendered background images, that is meaning
      contents cannot to modify or re-use in PowerPoint."
   → "[EXPERIMENTAL] Generate editable pptx (--pptx-editable)" … "requires installing both of
      the browser and LibreOffice Impress" … "may throw an error or output the incomplete result
      (e.g. gaia theme in Marp Core)" … "results in lower slide reproducibility" …
      "presenter notes are not supported" … "We do not recommend to export the editable PPTX
      if maintaining the slide's appearance is important."
   → "By default, Marp CLI will use 2 as the default scale factor in PPTX"（位图放大 2× 以掩盖栅格化劣化）
```

### 6.5 issue 取证命令与输出

```powershell
# 关键词批量筛选（临时脚本 .research/c-issues.ps1）
PS> gh issue list -R OWNER/REPO --limit 80 --state all --json number,title,state,comments,createdAt
   （对 tw93/Kami, marp-team/marp-core, slidevjs/slidev, sivan/heti, hakimel/reveal.js, hugohe3/ppt-master 逐个跑，
     再按 font|CJK|中文|overflow|wrap|line-break|theme|layout|export|pptx|scale 等关键词过滤）

命中（节选）：
  tw93/Kami       #6  19MB bundled font causes timeouts
                  #34 模板在新版 WeasyPrint (63.1) 下排版回归；内嵌 CJK 字体被替换
  marp-core       #209 Make built-in theme customization easy through CSS variables
                  #308 Content overlap with header and footer in included themes
                  #402 Autoscale support for table?
                  #158 / #244 / #396 …
  slidev          #2797 Editable PPTX export writes content: counter() as literal text
                  #2588 Named slot <img> disappear in one-piece PDF export when container has padding
                  #2764 Add fonts.body so the page face is not tied to font-sans
  sivan/heti      #115 zh-Hant 字體時標題擠壓不合預期
                  #124 .heti-adjacent-half should not appear on Chrome
                  #108 使用了 heti 样式后，文字无法居中
  hugohe3/ppt-master #199 Native PPTX text wraps/overflows in LibreOffice-rendered PDFs:
                          converter ignores letter-spacing & underestimates serif glyph width
                     #301 转换成PPTX后不居中    #192 zh-CN locale 对拉丁字体不友好

# 单个 issue 正文核实（临时脚本 .research/c-issue-detail.ps1 / -detail2.ps1）
PS> gh api repos/hugohe3/ppt-master/issues/199
TITLE: Native PPTX text wraps/overflows in LibreOffice-rendered PDFs: converter ignores letter-spacing & underestimates serif glyph width
STATE: closed  COMMENTS: 1  CREATED: 2026-06-24T11:07:09Z
URL: https://github.com/hugohe3/ppt-master/issues/199
BODY 关键：LibreOffice 忽略 wrap="none"；estimate_text_width() 忽略 letter-spacing（1–3px → 15–50px 未计入）；
           用 0.55em 平均字宽低估 serif 大写。修法：single_line_fudge = 1.40 if serif else 1.18，
           text_width += ls_px * (len(text)-1)

PS> gh api repos/marp-team/marp-core/issues/209
TITLE: Make built-in theme customization easy through CSS variables
STATE: closed  COMMENTS: 3  CREATED: 2021-02-04T17:08:42Z
BODY 关键：「This migration may make broken the look of exist Marp slides so this change must be the major update.」

PS> gh api repos/tw93/Kami/issues/34
TITLE: 模板在新版 WeasyPrint (63.1) 下排版回归：flex margin-left:auto 右对齐失效；内嵌 CJK 字体在 Quartz/预览下被替换
STATE: closed  COMMENTS: 1  CREATED: 2026-06-20T07:26:47Z
BODY 关键：WeasyPrint 63.1 不支持 flex auto margin；Quartz 不使用内嵌 CJK 字形→替换为系统黑体，
           紧凑排版下替换后更宽会造成重叠

PS> gh api repos/slidevjs/slidev/issues/2797
TITLE: Editable PPTX export writes content: counter() as literal text
STATE: open  COMMENTS: 0  CREATED: 2026-10-24T14:27:44Z
BODY 关键：slidev export --format pptx-editable 下 ::before{content:counter(step)} 输出为字面量 "counter(step)"

PS> gh api repos/sivan/heti/issues/115
TITLE: 使用 zh-Hant 字體時，Font kerning 的標題擠壓不合預期。
STATE: open  COMMENTS: 1  CREATED: 2023-09-29T11:58:59Z
BODY 关键：現行規則不論標點是否置中都往右壓 0.5em，與 zh-Hant 規範衝突；期望左右各 0.25em

PS> gh api repos/sivan/heti/issues/124
TITLE: Bug: .heti-adjacent-half style should not appear on Chrome
STATE: open  COMMENTS: 11  CREATED: 2024-12-19T01:19:22Z
BODY 关键：Chrome 131 下挤压过度；提议把 .heti-adjacent-half 限定到 Firefox/Safari

PS> gh api repos/sivan/heti/issues/108
TITLE: 使用了heti样式后，文字无法居中
STATE: open  COMMENTS: 1  CREATED: 2023-02-10T14:43:10Z
```

### 6.6 去伪存真记录（重要）

```powershell
PS> gh api repos/hakimel/reveal.js/issues/3914   # 2026-06-19 01:11:54
PS> gh api repos/slidevjs/slidev/issues/2637     # 2026-06-19 01:11:53
两次返回的正文为同一模板、同一推广项目（slide-alchemy），创建时间相差 1 秒。
→ 判定为跨仓推广贴，非真实缺陷报告，本轮不作为任何论据引用。
```

---

*本文件为 C 线唯一产出。未写任何产品代码，未拷贝任何候选项目源码（GPL/AGPL 仅读设计；本轮候选均为 MIT）。*
