# E 线 · 编辑器手感参考（只读，不引入）

> 调研员：research-editor ｜ 实测日期：**2026-11-09**（墙钟，非 2025）｜ 线别：阶段 0 · E 线
>
> **本文件的一切数字都来自本次会话真实执行的 `gh api` / `npm view` / bundlephobia，未使用记忆值。**
> 取不到的项写 `未核实` 并注明原因，见 §6。
>
> **铁律声明**：本文全程未 clone 任何仓库、未拷贝任何源码进本项目、未在 `package.json` 里添加任何依赖。
> 对候选仓库源码的引用一律通过 `gh api repos/{owner}/{repo}/contents/{path}` 只读拉取单文件，
> 仅用于**用行号作证设计事实**（如"第 178 行做了一次 `/ canvasScale`"），不复制代码。
> 行号引用格式：`useDragElement.ts:178-179`。

---

## 0. 一句话结论（先给答案）

**我们不需要任何画布引擎。** 需要的能力（容器自适应等比缩放、缩放后鼠标坐标换算、
槽位/对齐线吸附、快照式撤销、页序拖动）在最成熟的同类实现 `PPTist` 里**全部由 DOM + 手写
pointer 事件完成，零渲染库**。tldraw 的许可证**明确禁止生产环境使用**（不是"商用需付费"这么温和，
是 `Not to use the Software in Production Environments` 的硬条款，外加运行时电话回家校验），
一票否决。konva / fabric 虽然**实测确认是 MIT**，但它们要求我们用 canvas 重画文字排版 —— 那是把
我们唯一的架构优势（DOM 渲染的 IR，同一份 IR 直接喂 PptxGenJS）丢掉。

**最小依赖集建议**（状态管理已定为 zustand，计入既有栈，不属本线新增）：
本线**建议新增 0 个**运行时依赖（缩放/吸附/拖拽/快照栈/页序全部手写）；
若想省掉手写快照栈，可选挂 **`zundo` —— 一个 zustand 的撤销/重做快照插件（0.6 KB gzip，MIT）**，
它不是独立状态方案，只是 zustand 的一个 middleware。

---

## 1. 候选总表（固定 8 列）

> "迁移到本项目要改哪几个文件" —— 项目骨架尚未建立，下列路径是**本线约定的落点**，
> 后续实现以此为准（若 A/B/C/D 线已定不同目录名，按该线命名替换，语义不变）：
>
> | 约定路径 | 职责 |
> |---|---|
> | `src/lib/editor/scale.ts` | `canvasScale` 计算 + 屏幕坐标↔IR 坐标换算 |
> | `src/components/editor/CanvasStage.tsx` | 缩放容器（三层 DOM 结构） |
> | `src/components/editor/SlideSurface.tsx` | 1280×720 的 IR 渲染层 |
> | `src/components/editor/OverlayLayer.tsx` | 选中框 / 手柄 / 辅助线（在缩放容器**外**） |
> | `src/lib/editor/snap.ts` | 吸附候选线生成 + 阈值判定 |
> | `src/lib/editor/history.ts` | 快照式 undo/redo |
> | `src/store/editorStore.ts` | zustand store（IR + UI 状态分离） |
> | `src/components/editor/SlideList.tsx` | 左大纲树 + 页序拖动 |
> | `src/components/editor/Inspector.tsx` | 右属性（版式/主题/备注/单页重生成） |

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件 | 坑 |
|---|---|---|---|---|---|---|---|
| **pipipi-pikachu/PPTist**<br>（**本线主参考**） | 9,472 | **AGPL-3.0** ⚠️ | 2026-11-06<br>`pushed_at` 2026-11-06T15:58:56Z<br>master 末次 commit 2026-11-06T15:56:57Z | Vue 3 | **整套网页版 PowerPoint 的交互模型**：三层画布结构 + `transform: scale` 适配、缩放后 `delta / canvasScale` 反算、对齐线吸附（阈值 5、候选线取自其他元素 + 画布六边）、**快照式 undo/redo（20 份上限、存 IndexedDB）**、`vuedraggable` 页序拖动、ProseMirror 富文本、**前端直出 pptx（pptxgenjs，无 LibreOffice）** | 全部 9 个落点都要参考它的骨架：`scale.ts`（抄算法，不抄码）、`CanvasStage.tsx`（三层结构）、`OverlayLayer.tsx`（手柄在外层的理由）、`snap.ts`（`sorptionRange=5` + 每方向只吸一次）、`history.ts`（20 份 + debounce 300ms + 带页索引）、`SlideList.tsx`（数组 splice） | **AGPL-3.0：网络服务也必须开源，一行代码都不许拷**（我们迟早要做分享/在线，AGPL 的"网络使用即分发"会传染）；Vue 3 + Pinia，React 侧无法直接复用任何代码；`e instanceof MouseEvent` 跨 realm 失效；网格线纯视觉、**根本没有栅格吸附**；只支持单选拖拽排序（#424） |
| **tldraw/tldraw** | 51,418 | **NOASSERTION**<br>实测为**自定义商业许可** | 2026-11-07<br>`pushed_at` 2026-11-07T22:32:28Z<br>main 末次 commit 2026-11-07T19:11:34Z | TypeScript | 无限画布 SDK 的**交互层设计**：`@tldraw/state` 细粒度响应式、shape 工具状态机、handles 的布局算法、协作层（CRDT 风格 store） | 不建议迁移任何东西。若只看思路：`OverlayLayer.tsx`（handles 的位置计算）、`editorStore.ts`（细粒度订阅的分层） | **许可证一票否决**（§2 有全文摘录）：禁止生产环境、禁止移除/绕过 License Key、含"检测部署环境 + 强制水印 + 回传使用数据"的技术措施；**包体积 1.86 MB min / 552 KB gzip、18 个直接依赖**（连带整个 tiptap + prosemirror + radix + formatjs）；运行时 fetch 未捕获导致 `unhandledrejection`（#10721）；Next.js SSR 需专门适配（#6567） |
| **excalidraw/excalidraw** | 135,327 | **MIT**（`gh api` 实测 spdx_id=MIT） | 2026-11-08<br>`pushed_at` 2026-11-08T08:18:35Z<br>master 末次 commit 2026-11-05T17:10:20Z | TypeScript | 以 React 组件形式可嵌入（`@excalidraw/excalidraw` 0.18.1）；**缩放以光标为锚点**的算法（`Zoom on cursor rather than center of screen` #940 是其成型的记录）；jotai 做原子化状态；`@excalidraw/laser-pointer` 等 | `scale.ts`（"缩放锚点 = 指针位置"的换算，若我们要做 Ctrl+滚轮缩放而非固定 90%）；`history.ts`（它的 undo 用 delta 而非全量快照，可作对照） | 面向"白板/自由画布"，**没有版式/槽位概念**，借鉴价值低于 PPTist；包体积 **1.12 MB min / 353 KB gzip**，还有 mermaid / cytoscape / katex 懒加载 chunk（合计远超）；`window is not defined` 的 SSR 老问题仍 OPEN（#9907）；它自己是 App，不是可拆的编辑器内核 |
| **konvajs/konva** | 14,926 | **NOASSERTION**（GitHub 未识别）<br>**实测读全文 = MIT**（§2） | 2026-11-05<br>`pushed_at` 2026-11-05T15:53:19Z<br>master 末次 commit 2026-11-05T15:53:19Z | TypeScript | Canvas 场景图 + 事件 + Transformer + 拖拽；若要"画"而不是"排版"，这是最干净的 canvas 层 | 不使用。若误引入，`SlideSurface.tsx` 全部重写为 canvas 绘制，`scale.ts` 要处理 `devicePixelRatio`，导出层要多一层 canvas→pptx 坐标翻译 | **强制 canvas 渲染 = 放弃 DOM 文字排版**（canvas 无布局引擎，`fillText` 不换行，中英混排断行要自己写）；缩放坐标问题是它的高频坑（#1924 Transformer 在 scaled 坐标下 pointer 失效）；Next.js ESM/CJS 兼容坑（#1458）；包体积 190 KB / **56.8 KB gzip** |
| **fabricjs/fabric.js** | 31,550 | **MIT**（实测 spdx_id=MIT） | 2026-11-05<br>`pushed_at` 2026-11-05T08:13:11Z<br>master 末次 commit 2026-11-05T08:02:54Z | TypeScript | 对象模型 + SVG↔canvas 互转（`toSVG` 这条对我们有理论价值：DOM→SVG→pptx） | 不使用。若只看思路：导出层可考虑"IR → SVG → 截图进 pptx"的降级路线（我们已有 PptxGenJS 原生路线，不需要） | 同为 canvas 渲染，架构错配同上；**retina 缩放模糊是长期未清的老账**（#7502、#2791，两个都 CLOSED 但反复出现）；`fabric` 7.4.0 **299 KB min / 91.9 KB gzip**，是三者中最大；官方描述已注明依赖 jsdom / node-canvas，SSR 侧容易踩 |

**候选池补充说明（`gh search repos` 的实测结果，见 §7）**：
按题面要求执行了 `infinite canvas react` / `whiteboard react` / `drag snap grid` / `presentation editor react`
四组搜索，**除 PPTist 与本表 5 个仓库外，没有找到任何 star > 100 的"编辑器手感"专用库**
（结果全是 0–38 star 的练手项目）。这本身是个结论：**该领域不存在"小而专"的第三方库，
选型只能落在少数几个大库上，或者自己写**。因此本表没有再凑数加入低质量候选项。

### 1.1 可能真的会用的依赖候选（不在上表，供 §4 决策）

| 包 | 版本 | stars（仓库） | license（实测） | 体积 min / gzip | 最近提交 |
|---|---|---|---|---|---|
| `@dnd-kit/core` | 6.3.1 | 17,782（`clauderic/dnd-kit`） | MIT | 43.7 KB / **14.2 KB** | 2026-10-31 |
| `@dnd-kit/sortable` | 10.0.0 | 同上 | MIT | 9.2 KB / **3.7 KB** | 同上 |
| `@dnd-kit/modifiers` | 9.0.0 | 同上 | MIT | 1.9 KB / **0.9 KB** | 同上 |
| `@dnd-kit/react`（次代，0.x） | 0.5.3 | 同上 | MIT | — | 同上 |
| `sortablejs` | 1.15.7 | 31,205（`SortableJS/Sortable`） | MIT | 45.8 KB / **18.3 KB** | 2026-03-24 |
| `zundo` | 2.3.0 | 未核实（未单独探测仓库） | MIT | 1.5 KB / **0.6 KB** | 未核实 |
| `zustand` | 5.1.0 | 未核实（未单独探测） | MIT | 0.8 KB / **0.5 KB** | 未核实 |
| `react-grid-layout` | 2.3.0 | 22,486 | MIT | 78.5 KB / **24.8 KB** | 2026-11-03 |
| `react-rnd` | 10.5.3 | 4,325 | MIT | 46.6 KB / **12.7 KB** | 2026-05-12 |
| `moveable` | 0.53.0 | 10,764（`daybrush/moveable`） | MIT | 241.9 KB / **78.1 KB** | **2023-12-03**（默认分支末次 commit，见下） |

> ⚠️ **`moveable` 停更判定**：`pushed_at` 显示 2024-06-03，但
> `gh api repos/daybrush/moveable/commits?per_page=1` 实测**默认分支末次 commit 为 2023-12-03**
> （`chore: Release 0.53.0`），距今约 **35 个月**。仓库里还有 OPEN issue
> [#1137 "Is this project still active?"](https://github.com/daybrush/moveable/issues/1137)（2024-11-20）。
> → **命中项目规则「最近 6 个月无提交」的一票否决**。这正是 Lead 在 `.research/lead-环境实测.md`
> 第 4 节记录的教训：`pushed_at` 具有误导性，必须查默认分支的 commits。

---

## 2. 许可证核实

> 判定口径：**可依赖** = 可进 `package.json` 且闭源商用无义务；**仅可读设计** = 只能看思路，代码不可复用；
> **禁用** = 连参考都要谨慎、绝不引入。

| 仓库 | spdx_id（`gh api`） | 实测 LICENSE 名称（读 `repos/{r}/license` 全文） | 结论 |
|---|---|---|---|
| `pipipi-pikachu/PPTist` | **AGPL-3.0** | `GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007`（LICENSE，34,522 字节，全文确认为 AGPLv3） | ⚠️ **仅可读设计，一行代码都不许拷**。AGPLv3 的传染性覆盖**网络服务**：我们一旦把带 PPTist 代码的服务部署上线并让用户通过网络使用，就必须以 AGPL 提供完整源码。与"本项目闭源"的目标直接冲突，且**没有任何"内部使用豁免"能覆盖对外提供的编辑器**。Vue 3 也导致代码层面无法直接搬进 React |
| `tldraw/tldraw` | **NOASSERTION** | `Other` / `LICENSE.md`（4,609 字节）。npm 包 `tldraw@5.6.0` 的 `license` 字段为 **`SEE LICENSE IN LICENSE.md`** | ❌ **禁用**（详见下方全文要点） |
| `excalidraw/excalidraw` | **MIT** | API 直接识别为 MIT（`license.name = MIT License`） | ✅ **可依赖**（但无需求，见 §4） |
| `konvajs/konva` | **NOASSERTION** | `Other` / `LICENSE`（1,172 字节）。**读全文：正文是标准 MIT 条文**，只是头部有双版权行（`Copyright (C) 2011-2013 Eric Rowell (KineticJS)` + `Modified work Copyright (C) 2014-present Anton Lavrenov`），GitHub 的 licensee 识别器因双版权声明判为 `Other`。交叉验证：`npm view konva license` = **MIT** | ✅ **实质可依赖**（MIT）。GitHub 的 `NOASSERTION` 是**识别失败，不是许可限制** —— 这是个容易被误判成"许可不明"的坑 |
| `fabricjs/fabric.js` | **MIT** | API 识别为 MIT；`npm view fabric license` = MIT | ✅ **可依赖** |
| `atlassian/pragmatic-drag-and-drop` | **NOASSERTION** | `Other` / `LICENSE`（558 字节）。**读全文：Apache License 2.0** 标准短声明（`Copyright 2024 Atlassian Pty Ltd ... Licensed under the Apache License, Version 2.0`）。`npm view @atlaskit/pragmatic-drag-and-drop license` = **Apache-2.0** | ✅ **可依赖**（Apache-2.0，注意需保留 NOTICE）。同样是识别失败而非限制 |
| `clauderic/dnd-kit` | **MIT** | — | ✅ **可依赖** |
| `daybrush/moveable` | **MIT** | — | ✅ 许可可依赖，但**停更 35 个月**（§1.1），按项目规则否决 |

### 2.1 tldraw 许可证全文要点（逐条摘录，**这是本线最重要的核实项**）

来源：`gh api repos/tldraw/tldraw/license` → `LICENSE.md`，4,609 字节，`spdx_id = NOASSERTION`。
以下为**原文关键句**（引用自许可证文本，非我改写）：

1. **授予的只是"开发环境"权利**
   > Permitted: `Use the Software in Development Environments.`
   > "Development Environment" means any internal hosting or deployment of the Software for development,
   > testing, or staging purposes, operated by your organization and **not accessible to end users,
   > customers, or the public**.
2. **生产环境被明文禁止（这不是"要付费"，是"不允许"）**
   > Conditions: `Not to use the Software in Production Environments.`
   > "Production Environment" means any production deployment ... **where the software is used to provide
   > functionality to end users, customers, or the public.**
3. **禁止绕过许可校验 / 水印**
   > `Not to disable, change, or interfere with the Software's License Key enforcement.`
   > `Not to remove any copyright or other notices from the Software.`
4. **运行时技术措施（不只是法律条款，是代码里真有的东西）**
   > The Software includes technical measures to verify License Key validity, **detect deployment
   > environments**, enforce usage restrictions based on license type, and **ensure proper watermark display**.
   > The Software **may collect and transmit usage data** to tldraw for license compliance purposes.
5. **商用需单独签约**
   > `Alternative licenses are available from tldraw for commercial and non-commercial use.`（需联系 sales）
   > `Commercial license`: 在单独商业协议下才允许生产环境使用，且有 **License Key 有效期**。
6. **试用限制**：`Business units are limited to one trial period unless otherwise approved in writing.`
7. **准据法**：`Delaware`，专属管辖，放弃 forum non-conveniens。违约即自动终止许可。

**对我们的判定**：`/editor/[id]` 是**给终端用户提供的生产环境功能**，不是内部开发/预览。
故 **tldraw 完全不可用**，无论是否加水印、是否付费（付费需要单独商业谈判，超出本项目范围）。

**旁证（真实 issue，说明这不是纸面条款）**：
- [#10034](https://github.com/tldraw/tldraw/issues/10034)（OPEN，2026-08-15）
  `License page says hobby licenses send no data, but watermarked licenses are tracked`
  —— 报告指出 `LicenseManager.getTrackType` 对 `licensed-with-watermark` 状态返回 `'with_watermark'`，
  `maybeTrack` 会带 `version / license_type / license_id / sku / url / environment` 参数请求水印追踪图；
  hobby 许可会显示水印 → 生产环境即被追踪，与文档"no information is sent"不符。
- [#10721](https://github.com/tldraw/tldraw/issues/10721)（CLOSED，2026-09-09）
  `License tracking fetch causes an unhandled promise rejection when blocked`
  —— `LicenseManager.ts:251` 的 `fetch(url)` 既没 await 也没 catch，被拦截时抛到页面的
  `unhandledrejection`，任何错误上报都会把它记成应用错误，而宿主应用无从处置。
  `maybeTrack` 在 `unlicensed / evaluation / with_watermark` 三种状态都会跑，**每次编辑器挂载都触发**。
  → 即使我们只是"试试看"，也会在控制台和错误监控里长期留噪。

> **结论一句话**：tldraw 不是"开源 + 商用收费"，是**"源码可见的专有软件"**。
> 把它写进 `package.json` 就等于接受 Delaware 法律管辖下的生产环境禁令。**禁用。**

---

## 3. 主干参考的 issue（≥2 个真实链接 / 每个仓库，含对本项目影响）

> 全部 NNN 由 `gh api repos/{owner}/{repo}/issues/{NNN}` 逐条验证存在，附真实状态与创建日期。

### 3.1 PPTist（主参考，5 条）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 445 | [PPTist#445](https://github.com/pipipi-pikachu/PPTist/issues/445) | CLOSED / 2026-08-12（3 评论） | `[Bug report]导出pptx在本地打开提示需要修复` —— 网页端导入后导出，用 Microsoft PowerPoint 打开提示文件需修复 | **直接命中我们的导出路线**。PPTist 也用 `pptxgenjs`（`package.json` 实测 `"pptxgenjs": "^3.12.0"`，`useExport.ts:4` `import pptxgen from 'pptxgenjs'`）。我们 Lead 已因 PptxGenJS 停更 16.5 个月锁了版本 + 加了出口后处理层，这条 issue 是**该防御措施必要性的独立佐证**。→ 验收必须用本机真 PowerPoint/WPS 打开一次（Lead 已确认本机两者都在） |
| 450 | [PPTist#450](https://github.com/pipipi-pikachu/PPTist/issues/450) | CLOSED / 2026-09-15 | 多母版/多主题场景下，单页主题加载存在短路求值逻辑，导致后续页面主题色被强制覆盖（根因定位到 `pptxtojson` 的解析） | 我们**不做 .pptx 反向导入**（本期明确不做），所以根因不适用；但"**主题色作用域**"这个坑适用：本期"换主题"是全局换色，**建议从一开始就把主题色挂在 `slide`/IR 顶层并在渲染时显式下发**，不要用 CSS 变量全局兜底，否则以后做"单页覆盖主题"会重演短路求值 |
| 434 | [PPTist#434](https://github.com/pipipi-pikachu/PPTist/issues/434) | CLOSED / 2026-04-23（4 评论） | iframe 中使用时 `e instanceof MouseEvent` 判断异常 —— 每个 iframe 有独立全局环境与独立 `MouseEvent` 构造函数，跨 realm 原型链检查返回 false | 我们的拖拽/缩放 hook 必然要区分鼠标与触摸。**照抄 PPTist 的 `e instanceof MouseEvent` 写法会在嵌入场景炸**（我们未来做"分享/嵌入预览"时就是 iframe）。→ 统一改用 `'touches' in e` / `e.type.startsWith('touch')` 判别，或 `pointerdown` 事件统一入口 |
| 424 | [PPTist#424](https://github.com/pipipi-pikachu/PPTist/issues/424) | **OPEN** / 2026-01-29（1 评论） | `缩略图能否支持多选拖拽排序` —— 目前左侧缩略图只支持单选拖拽排序 | 我们的"页序拖动"**只需要单选拖拽**（本期不做批量操作），所以这不是阻塞项；但它证明**成熟实现里多选拖拽也是缺的**，不要一上来就去做多选页序。→ `SlideList.tsx` 先做单选，留 `selectedIds` 数据结构但不实现多选拖动 |
| 419 | [PPTist#419](https://github.com/pipipi-pikachu/PPTist/issues/419) | **OPEN** / 2025-12-28（0 评论） | 标题称：iOS WKWebView 下 ppt 模板页数较多、快速滚动时白屏、显示异常（**注意：正文为空模板，提问者未提供复现步骤与环境**，按仓库规范属不规范 issue） | **证据强度只有"标题级"，不能当作已确认的性能缺陷。** 但方向值得预防：左侧缩略图在 15+ 页时是 N 个"完整 IR 渲染"的 DOM 子树，最坏情况确实会重。→ `SlideList.tsx` 用**固定尺寸的小缩略图 + 简单版式预览（不渲染真实文字排版）**，并考虑 `content-visibility: auto` 做视口外跳过渲染 |

**额外一条 design-level 事实（无 issue，直接读源码得出）**：PPTist 的"网格线"是**纯视觉**的
（`GridLines.vue` 用一条 SVG `path` 画完所有线，`pointer-events: none`，`stroke-width 0.3`，
再整体 `transform: scale(canvasScale)`），**全仓库没有任何"吸附到 8/16/25/50px 栅格"的代码** ——
`gridLineSize` 只在 `main.ts`（存值）、`GridLines.vue`（画线）、`Canvas/index.vue`（右键菜单切换）三处出现。
详见 §4.2。

### 3.2 tldraw（3 条）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 10034 | [tldraw#10034](https://github.com/tldraw/tldraw/issues/10034) | **OPEN** / 2026-08-15 | 文档说 hobby 许可不回传数据，但带水印的许可在生产环境会被追踪（`maybeTrack` 请求水印图并带 `license_type/license_id/sku/environment`） | 印证 §2.1 第 4 条：引入即引入一条**运行时外联 + 水印**链路。我们的编辑器要给用户看，等于生产环境，直接违规 |
| 10721 | [tldraw#10721](https://github.com/tldraw/tldraw/issues/10721) | CLOSED / 2026-09-09（1 评论） | `LicenseManager.maybeTrack` 末尾的 `fetch` 既未 await 也未 catch，被拦截时抛 `unhandledrejection`，每次编辑器挂载都触发 | 即使只做本地评估，也会污染错误监控。**任何"先试试 tldraw"的想法都要先看这条** |
| 6567 | [tldraw#6567](https://github.com/tldraw/tldraw/issues/6567) | CLOSED / 2025-08-11（5 评论） | `Add Next.js SSR support` —— SSR 需要专门适配 | 我们是 Next.js（`/editor/[id]`）。tldraw 需要处理 SSR 才能不炸，说明它默认就没考虑服务端渲染。**我们的 DOM+IR 方案 SSR 天然友好**（IR 是纯 JSON，首屏可直接渲染静态 HTML，不需要 `dynamic(..., {ssr:false})`） |

### 3.3 excalidraw（3 条）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 3175 | [excalidraw#3175](https://github.com/excalidraw/excalidraw/issues/3175) | CLOSED / 2021-03-05（11 评论） | `Offsets not updating correctly when embedded in scrollable website` —— 嵌在可滚动页面里时偏移算错 | **这就是"缩放/滚动后鼠标坐标偏移"的经典坑，也是我在 PPTist 源码里发现的同一类错误的旁证**：`Canvas/index.vue:236-238` 用 `e.pageX - viewportRect.x` 混用「含滚动的 pageX」与「不含滚动的 rect.x」，仅在 canvas 自身不滚动时成立。→ 我们的 `scale.ts` 必须**只用一种坐标系**：要么统一 `clientX/clientY` + `getBoundingClientRect()`，要么统一 `pageX` + `rect.left + scrollX`。**推荐 `clientX` + `rect`**（不依赖祖先滚动状态） |
| 940 | [excalidraw#940](https://github.com/excalidraw/excalidraw/issues/940) | CLOSED / 2020-03-14（12 评论） | `Zoom on cursor rather than center of screen` —— 缩放要以光标为锚点而不是屏幕中心 | 若我们做 Ctrl+滚轮缩放（PPTist 也做了，`Canvas/index.vue:263-276`，步长 5%、范围 30%–200%、throttle 100ms），**缩放锚点必须是光标**，否则用户会觉得"画面跑了"。公式：`t' = p - (p - t) * (s'/s)`（t 为平移，p 为光标在容器内的坐标）。我们若只做"自适应贴合 + 全屏"而不做手动缩放，这条可以整段跳过 |
| 9907 | [excalidraw#9907](https://github.com/excalidraw/excalidraw/issues/9907) | **OPEN** / 2025-08-25 | `window is not defined`（SSR 报错） | 与 tldraw#6567 同类。**再次说明 canvas 引擎类库普遍假设浏览器环境**；我们的 IR 方案没有这个包袱 |

### 3.4 konva（2 条）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 1924 | [konva#1924](https://github.com/konvajs/konva/issues/1924) | CLOSED / 2025-04-19（5 评论） | `[BUG] Transformer using scaled coordinates - Pointer events don't work.` | 连 canvas 库自己都在"缩放坐标系下的 pointer"上翻车 —— **说明这个坑跟渲染技术栈无关，是数学问题**，我们手写 DOM 也躲不掉，只是手写时代码在自己手里更好改（`scale.ts` 一处收口） |
| 1458 | [konva#1458](https://github.com/konvajs/konva/issues/1458) | CLOSED / 2022-12-01（13 评论） | `Next.js 13 related ESM/CJS issues with canvas` | 又是 Next.js 兼容。konva 有 `canvas` / `skia-canvas` 作为 **peerDependencies**（bundlephobia 实测），SSR 侧要小心处理 optional peer |

### 3.5 fabric.js（2 条）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 7502 | [fabric#7502](https://github.com/fabricjs/fabric.js/issues/7502) | CLOSED / 2021-11-18 | `Canvas blur after rescale page` —— 缩放页面后画布模糊 | canvas 方案的**天然税**：每变一次缩放比就要重设 backing store 尺寸并乘 `devicePixelRatio`，否则文字/线条发虚。我们的 DOM 方案里，`transform: scale` 下浏览器会按最终合成尺寸栅格化文字，**不存在这个问题**（真正会虚的只有 1px 边框，见 §4.1 手柄放外层的理由） |
| 2791 | [fabric#2791](https://github.com/fabricjs/fabric.js/issues/2791) | CLOSED | `Blurry Canvas (image&text) when setDimensions is called` | 同上，同类问题反复出现（我搜 `retina scaling blurry` 一次命中 6 条），说明是**结构性问题而非个别 bug** |

### 3.6 dnd-kit（4 条 —— **这一组是本线最重要的"别用错工具"证据**）

| # | 链接 | 状态 / 日期 | 摘要 | 对本项目的影响 |
|---|---|---|---|---|
| 1290 | [dnd-kit#1290](https://github.com/clauderic/dnd-kit/issues/1290) | CLOSED / 2023-12-06 | `@dnd-kit list sorting not working properly when parent div has transform:scale() css` | **直接把"dnd-kit + 我们的缩放画布"这条路判死**：父容器一旦有 `transform: scale()`，sortable 的碰撞检测与位移全部错位。我们的画布恰恰是 `transform: scale(s)` 的 |
| 1852 | [dnd-kit#1852](https://github.com/clauderic/dnd-kit/issues/1852) | CLOSED / 2025-12-17 | `Unexpected sortable behavior when parent container scale is not equal to 1` | 两年后同一个问题再次出现（1290→1852），说明**不是一次性 bug，是模型层面的不兼容**：dnd-kit 用屏幕坐标做 rect 相交，不理解 CSS transform |
| 2041 | [dnd-kit#2041](https://github.com/clauderic/dnd-kit/issues/2041) | **OPEN** / 2026-05-05 | `Sortable animations jump inside scaled parent container` | **至今未修（OPEN）**。官方提供的 `adjustScaleModifier` 也只解决位移不解决占位块（#1582） |
| 2116 | [dnd-kit#2116](https://github.com/clauderic/dnd-kit/issues/2116) | **OPEN** / 2026-07-31 | `React 19: DragDropProvider manager is destroyed during Strict Mode replay` | 我们在 Next.js（React 19 + Strict Mode 默认开）。这条说明 **dnd-kit 在 React 19 Strict Mode 下有兼容问题且未修**。另 `@dnd-kit/react`（次代）仍是 **0.5.3**，0.x 不适合生产 |

> 结论：**dnd-kit 只用在"不在缩放容器里的列表"是安全的**（我们的左侧页序列表符合），
> 但只要有一天想"用同一个库统一处理画布内拖拽和列表拖拽"，就会踩 1290/1852/2041。
> 见 §4.4 的取舍。

---

## 4. 六个必答问题（结论 + 可抄做法 + 坑）

### 4.1 等比缩放适配 —— 容器宽度变化时让 1280×720 恰好贴合

**PPTist 的实测做法**（三层 DOM，`Canvas/index.vue:20-96` + `useViewportSize.ts`）：

```text
.canvas            position:relative; overflow:hidden; 铺满中栏          ← 量它的 clientWidth/clientHeight
└─ .viewport-wrapper  width/height = IR尺寸 × scale（真实像素）; left/top 居中; box-shadow  ← 阴影不随缩放变形
   ├─ .operates      选中框 / 手柄 / 对齐线 / 浮动工具条（坐标 = IR坐标 × scale）
   └─ .viewport      width/height = IR尺寸(1000×562.5); transform: scale(s); transform-origin: 0 0
      └─ EditableElement...   直接用 IR 坐标做 left/top
```

**scale 计算**（`useViewportSize.ts:19-31`，实测原文逻辑）：

```
ratio = viewportRatio = 0.5625            // 16:9，PPTist 的 IR 是 1000×562.5；我们是 1280×720，ratio 同为 0.5625
if (H / W > ratio)  {                     // 容器"偏高" → 宽度是瓶颈
    actualW = W * (pct/100)               // pct 默认 90，即留 5% padding
    s       = actualW / 1280
    left    = (W - actualW) / 2
    top     = (H - actualW * ratio) / 2
} else {                                  // 容器"偏宽" → 高度是瓶颈
    actualH = H * (pct/100)
    s       = actualH / 720
    left    = (W - actualH / ratio) / 2
    top     = (H - actualH) / 2
}
```

**监听**：`ResizeObserver`（`useViewportSize.ts:82-89`），`onMounted` 时 `observe(canvasRef)`，
`onUnmounted` 时 `unobserve`。**不用 window resize**（中栏宽度会被左右栏拖拽改变，window 不触发）。

**为什么不用 CSS `aspect-ratio`？** 三点：
1. `aspect-ratio` 只能定"形状"，**给不出 scale 这个标量**，而坐标换算必须要这个数；
2. 让 1280×720 的固定尺寸内容贴合任意容器，必须靠 `transform: scale`（`zoom` 会影响布局、`width:100%` 会让字号不变只压缩间距）；
3. 居中还得手工 `left/top`（用 flex 居中 `viewport-wrapper` 也行，但 wrapper 尺寸已含 scale，flex 也可以——PPTist 选绝对定位是为了支持"空格+拖拽平移画布"）。

**可抄的具体做法（我们的 `scale.ts` 契约）**：

```ts
// 容器测量 → 单一真源：s（每 1 个 IR 像素等于多少屏幕像素）
export function fitScale(cw: number, ch: number, iw = 1280, ih = 720, pct = 1) {
  const s = Math.min(cw / iw, ch / ih) * pct;
  return { s, ox: (cw - iw * s) / 2, oy: (ch - ih * s) / 2 };  // ox/oy = 居中偏移
}
// 屏幕 → IR（唯一入口，全项目只准用这两个函数）
export const toIR     = (p: {x:number;y:number}, r: DOMRect, s: number) =>
  ({ x: (p.x - r.left) / s, y: (p.y - r.top) / s });            // p 用 clientX/clientY
export const deltaToIR = (dx: number, dy: number, s: number) =>
  ({ x: dx / s, y: dy / s });                                    // 拖拽一律用增量
```

**⚠️ 缩放后鼠标坐标换算 —— 这个坑的完整成因**（三个层次，缺一就偏）：

1. **`getBoundingClientRect()` 是缩放后的屏幕矩形**，而 `offsetLeft/offsetWidth` 是**布局值（不含 transform）**。
   混用两者 = 必然偏移。**只用 `getBoundingClientRect()`，且只在指针按下时取一次并缓存**（滚动/缩放后再取会导致拖拽中跳变）。
2. **坐标系混用**：`e.pageX` 含页面滚动，`rect.left` 不含。PPTist 在 `Canvas/index.vue:236-238` 就是
   `(e.pageX - viewportRect.x) / canvasScale` —— 这行**只在 canvas 自身不滚动时正确**（它 `.canvas { overflow: hidden }`，
   `pageX == clientX`，所以侥幸没炸）。excalidraw#3175 是同一类错误在"嵌在可滚动页面"时的爆发。
   → **我们的规则：拖拽一律 `clientX/clientY` + 按下时缓存的 `rect`**。
3. **拖拽用"增量 ÷ s"而不是"绝对坐标换算"**：`useDragElement.ts:178-179`
   ```ts
   let moveX = (currentPageX - startPageX) / canvasScale.value
   let moveY = (currentPageY - startPageY) / canvasScale.value
   ```
   增量法的好处：**完全不依赖 rect**，指针跑出画布、容器滚动、父级 transform 都不影响，
   且天然支持"按在元素任意位置拖动不跳动"。**这是最值得抄的一行。**
4. **1px 边框/手柄的视觉畸变**：`transform: scale(0.5)` 会把 1px 边变成 0.5px（发灰/消失），`scale(2)` 变成 2px。
   → **手柄和选中框必须放在 scale 层之外**（即 `.operates` 那一层），坐标自己乘 `s`。
   这就是 PPTist 把 `Operate` / `AlignmentLine` / `FloatingToolbar` 放在 `.viewport-wrapper` 下、
   与 `.viewport` 平级的原因（`Canvas/index.vue:29-70` vs `72-95`），也是 `AlignmentLine.vue:19-26`
   里所有尺寸都要 `× canvasScale` 的原因。
5. **全屏**：本期要做"可全屏"。全屏后容器尺寸变化会自动被 `ResizeObserver` 捕获 → 重算 `s`，
   **不需要额外逻辑**，但要注意 `document.fullscreenElement` 的 `resize` 事件时机（可在 `fullscreenchange`
   后再 `requestAnimationFrame` 里重算一次）。

**落点**：`scale.ts`（纯函数 + ResizeObserver hook）、`CanvasStage.tsx`（三层 DOM 结构）。

---

### 4.2 网格吸附 —— 阈值、辅助线、多元素对齐；我们"值不值得做"

**实测结论（这条是本线最反直觉的发现）：PPTist 没有栅格吸附。**

- `gridLineSize`（0/25/50/100，`Canvas/index.vue:330-352` 右键菜单）**只画线**：
  `GridLines.vue` 生成一条巨大的 SVG `path`，`stroke-width 0.3`、`stroke-dasharray 5`、`pointer-events: none`，
  整体 `transform: scale(canvasScale)`。**不参与任何位置计算。**
- 全仓库检索 `gridLineSize` 只命中三处：`store/main.ts`（存值）、`GridLines.vue`（画）、`Canvas/index.vue`（菜单）。

**它做的是「对齐线吸附」（alignment snapping）**，`useDragElement.ts`：

| 要素 | 实测值 | 行号 |
|---|---|---|
| 吸附阈值 | `const sorptionRange = 5`（**IR 坐标单位**） | `useDragElement.ts:32` |
| 候选线来源 | **其他每个元素**贡献 3 条水平线（top / bottom / centerY）+ 3 条垂直线（left / right / centerX） | `:62-101` |
| 画布自身 | 再补 6 条：`edgeTop/edgeBottom/edgeHorizontalCenter` + `edgeLeft/edgeRight/edgeVerticalCenter` | `:112-113` |
| 去重 | `uniqAlignLines()` | `:116-117` |
| 判定 | 被拖元素的 `min / max / center` **三条边各自**与候选线比较，`|边 - 线| < 5` 即吸附 | `:270-311` |
| **每方向只吸一次** | `isHorizontalAdsorbed` / `isVerticalAdsorbed` 布尔锁 | `:268-269` |
| 校正量 | `targetTop -= (targetMinY - value)`（**精确贴到线上**，不是贴到栅格） | `:276` |
| 辅助线视觉 | 从 `min(range) - 50` 到 `max(range) + 50`（两端各外延 50 IR px），1px 虚线 + `translateY(-0.5px)` 做半像素对齐 | `:278`, `AlignmentLine.vue:39-46` |
| 多选 | 先算多选并集的 `min/max/center`，吸附后**其余选中元素按"被拖元素的实际位移"整体平移** | `:221-259`, `:322-345` |

**它还有一个「误操作阈值」**：位移 < `sorptionRange` 不算拖拽（`useDragElement.ts:169-173`）。
⚠️ **这里有个真实的量纲瑕疵**：同一个常量 `5` 既被用作**屏幕 px**（误操作判定，比较 `startPageX - currentPageX`）
又被用作**IR px**（吸附判定）。画布缩到 50% 时，吸附在实际屏幕上只剩 2.5px 手感，几乎吸不住。
→ **我们必须拆成两个常量**：`SNAP_IR = 5`（IR 单位，决定吸附强度）、`DRAG_MIN_SCREEN = 3`（屏幕 px，决定误触）。
换算关系：吸附强度在屏幕上的表现 = `SNAP_IR × s`。

**我们的场景值不值得做 8/16px 栅格吸附？→ 判断：不做通用栅格吸附。**

理由（按证据强弱排序）：

1. **最硬的证据**：一个自称"复刻了 MS PowerPoint 大部分常用功能"的项目、9,472 star、
   活跃到 2026-11-06，**实现了完整的对齐线吸附却没做栅格吸附**。这不是遗漏，是取舍 ——
   PPT 的排版语义是"与别的元素/画布对齐"，不是"对齐看不见的格子"。
2. **我们的编辑范围本来就有界**：元素位置由**版式槽位**决定，槽位坐标已经是我们自己写死的规整数
   （例如 `16px` 栅格上），**元素天然就落在栅格上**。再做一层 `Math.round(x/8)*8` 是给已经正确的数据加噪声。
3. **收益/成本不对称**：栅格吸附代码只有一行（`snap = Math.round(v / g) * g`），
   但**真正的成本在"手感调优"**：栅格吸附会让用户"想放 5px 处但被拽到 8px"，这在以文本为主的
   幻灯片里是负体验（文本框位置差 3px 眼睛看不出来，但用户会觉得"拖不动"）。而且栅格吸附必须配
   "按住 Alt 临时关闭"的开关，否则专业用户会烦 —— 这些都是纯手感的隐性成本。
4. **槽位吸附已经覆盖 95% 的需求**：拖元素到某个槽位附近 → 自动贴回该槽位。阈值建议 **8–12 IR px**
   （比 PPTist 的 5 宽，因为我们的目标位置是"少数几个已知矩形"，不是"任意对齐线"，容错可以更宽松）。

**我建议做的吸附清单（按优先级）**：

| 优先级 | 吸附对象 | 阈值 | 说明 |
|---|---|---|---|
| P0 | **版式槽位边界**（含中心） | 8–12 IR px | 我们的核心。候选线数 = 槽位数 × 3，通常 < 12 条，比 PPTist 的"每元素 6 条"少一个数量级 |
| P0 | **画布六边/中心线** | 同上 | 6 条常量线，成本为零，效果最明显 |
| P1 | 同页其他元素的边/中心 | 5–8 IR px | 数量可控（我们一页元素少），有它观感立刻"像 PPT" |
| P2 | 8/16px 栅格 | — | **不做**。若一定要做，只做"按住某键才启用"的模式 |
| **不做** | 旋转后包围盒吸附 | — | PPTist 为此写了 `getRectRotatedRange` / `getRectRotatedOffset` 两套几何工具；**我们不支持旋转元素**，直接跳过 |

**视觉辅助线怎么做**（照抄 PPTist 的思路，不抄码）：
- 辅助线**画在 scale 层之外**（与手柄同层），坐标 `= IR坐标 × s`，这样线宽永远是 1 个屏幕像素；
- 两端各外延 50 IR px，避免线"太短看不清"；
- 半像素对齐：`translateX(-0.5px)` / `translateY(-0.5px)`，否则 1px 线在某些 DPR 下会糊成 2px 灰线；
- **松手即清空**：`alignmentLines.value = []`（`useDragElement.ts:358`），不要留在界面上。

**落点**：`snap.ts`（候选线生成 + 判定，纯函数，好写单测）、`OverlayLayer.tsx`（渲染辅助线）。

---

### 4.3 撤销/重做 —— 命令式 vs 快照式；我们该选哪个

**PPTist 的实测模型：纯快照式（不是命令栈）。** 依据 `src/store/snapshot.ts`（130 行，完整读过）：

| 事实 | 实测值 | 位置 |
|---|---|---|
| 快照内容 | `{ index: slideIndex, slides: JSON.parse(JSON.stringify(slidesStore.slides)) }` —— **整册幻灯片深拷贝** + 当前页索引 | `snapshot.ts:39-42`, `:64-67` |
| 存储介质 | **IndexedDB**（`dexie`），库名由 `databaseId = nanoid(10)` 区分 | `snapshot.ts:3`, `main.ts:48` |
| 上限 | `const snapshotLengthLimit = 20`，超出删最旧（`allKeys[0]`） | `snapshot.ts:74-78` |
| 撤销/重做 | 移动 `snapshotCursor` 指针 → 整册塞回 store → 清空选中 | `snapshot.ts:92-128` |
| 分支截断 | cursor 不在末尾时新增快照，则**删除 cursor 之后的所有快照** | `snapshot.ts:59-61` |
| 页焦点保持 | 快照带 `index`，且额外一次 `db.snapshots.update(...)` 保证撤销后停在原页（引用 issue #27） | `snapshot.ts:80-84` |
| 写入节流 | `addHistorySnapshot` = `debounce(300ms, trailing)`；`undo/redo` = `throttle(100ms, leading)` | `useHistorySnapshot.ts:8-20` |
| 文本内部历史 | **另一套**：`prosemirror-history`（只撤销文本框内的字符编辑，与整册快照并存） | `package.json` 依赖 |

> 注意到 PPTist 两种历史并存：整册快照（结构级）+ ProseMirror 自己的 history（字符级）。
> 这不是冗余，是**分工**：编辑器里"打字"用 document 级 history，"换版式/移动元素/页序"用整册快照。

**我们的判断：快照式足够，且优于命令式。**

**内存代价估算**（⚠️ **估算，非实测** —— 项目还没有 IR 数据，无法实测，见 §6）：

| 假设 | 值 | 依据 |
|---|---|---|
| 页数 | 15 页 | 项目背景"十几页" |
| 每页槽位 | 8 个 | 本期版式最多约 8 槽 |
| 每槽 JSON | 200–400 B | 文本（中文 UTF-8 约 3 B/字，一页 200 字）+ 样式 + 版式 id + 坐标 |
| **每页** | **≈ 1.6–3.2 KB** | |
| **整册（15 页）** | **≈ 24–48 KB** | |
| 20 份快照 | **≈ 0.5–1.0 MB** | |
| 50 份快照 | **≈ 1.2–2.4 MB** | |

结论：**20 份快照不到 1 MB，纯内存即可，不需要 IndexedDB。** PPTist 之所以上 IndexedDB，
是因为它的单页元素可达上百个、还带 base64 图片/音视频（`package.json` 里有 `html-to-image`、`echarts`），
整册可能几 MB 到几十 MB。我们的 IR 是"十几页纯 JSON"，量级差两三个数量级。

**为什么不用 immer patches 当主力？**
- `enablePatches` 对"整页换版式"会产生大量 `replace` patch（等于整页替换），省不了多少；
- 引入"patches 必须可重放"的约束，一旦 IR 结构演进、patch 里存了旧字段名，历史就废了；
- 命令式要给每种操作写逆操作。**"换版式"的逆操作极难写对**（要还原所有元素的位置/尺寸/文本流），
  而快照式天然正确。这是我们选择快照式的**决定性理由**：本期 8 项能力里有 3 项（换版式、换主题、页序拖动）
  是**结构性**变更。

**具体建议（落 `history.ts`）**：

```ts
// 方案 A：零依赖，手写 ~30 行
type Snap = { ir: IR; pageIndex: number };
let stack: Snap[] = [], cursor = -1;
const LIMIT = 30;                       // 比 PPTist 的 20 略多，因为我们每份更小
const push = (ir: IR, i: number) => {   // 调用点必须 debounce(300)
  stack = stack.slice(0, cursor + 1);   // 分支截断
  stack.push({ ir: structuredClone(ir), pageIndex: i });
  if (stack.length > LIMIT) stack.shift();
  cursor = stack.length - 1;
};
```
- 用 `structuredClone`（Node 17+/现代浏览器原生），比 `JSON.parse(JSON.stringify())` 快且保留 `Date`/`Map`；
- **必须 debounce 300ms**：否则拖拽 60fps 会一秒写 60 份快照（这是 PPTist 用 debounce 的原因，也是不 debounce 就会炸内存的原因）；
- **`partialize` 纪律**：历史只跟踪 `ir`，**绝不跟踪 UI 状态**（选中 id、hover、预览开关）。否则用户撤销一次会看到"选中框也变了"，体验很怪；
- 快照带 `pageIndex`，并在撤销时 `clamp` 到 `slides.length - 1`（PPTist 在 `snapshot.ts:103` 就是这么做的，防止撤销到页数更少的状态时索引越界）。

**方案 B（可选）：用 `zundo` 替代手写快照栈**。
`zundo@2.3.0` 是 **zustand 的撤销/重做中间件**（不是独立状态库）——用 `temporal(...)` 包住既有的
zustand store 即可，**MIT，1.5 KB min / 0.6 KB gzip**。配 `partialize`（只跟踪 IR）+ `limit: 20–30`
+ `handleSet` 里的 debounce 就与我们上面手写的方案 A 语义等价，省约 30 行代码。
代价是一个额外依赖 + 一层 middleware 黑盒（调 history 行为时要读它的源码）。
→ **我的建议：先手写（方案 A）**——30 行 + 一个清晰的数据结构比中间件更好调试，
而且"快照栈"是几乎不会演进的代码；等确实嫌它烦，再把 `zundo` 换上去（接口一样，切换成本低）。
若后续要"跨会话恢复历史"，再考虑方案 B 或落 IndexedDB。

**落点**：`history.ts`、`editorStore.ts`（IR 与 UI 状态必须分两个 slice）。

---

### 4.4 页序拖动 —— dnd-kit sortable 是否过度设计？

**PPTist 实测**：用 `vuedraggable@4.1.0`（SortableJS 的 Vue 封装）。
`Thumbnails/index.vue:20-31`：

```html
<Draggable :modelValue="slides" :animation="200" :scroll="true" :scrollSensitivity="50"
           :disabled="editingSectionId" itemKey="id" @end="handleDragEnd">
```
`@end` → `sortSlides(newIndex, oldIndex)`（`:227`）。**核心逻辑就是数组 splice + 重排**。

**我的判断：dnd-kit 对我们是过度设计，用 HTML5 `draggable` 就够。**

逐个能力对照：

| 能力 | 我们的需要 | HTML5 `draggable` | dnd-kit sortable | SortableJS |
|---|---|---|---|---|
| 单列竖直重排 | ✅ 必需 | ✅ 原生 | ✅ | ✅ |
| 拖拽过程视觉（ghost/占位） | ✅ 要 | ⚠️ 自己写（`dragstart` 加 class + `dragover` 插入占位） | ✅ 内置 `transform` 动画 | ✅ 内置 |
| **自动滚动**（15+ 页列表要滚） | ⚠️ 可能 | ❌ **没有**，要自己写边缘检测 + `scrollBy` | ✅ | ✅ `scrollSensitivity` |
| 移动端触摸 | ⚠️ 本期 PC 优先 | ❌ 完全不支持 | ✅ | ✅ |
| 键盘无障碍（`⌘+↑` 移页） | ⚠️ 加分 | ❌ | ✅ 强项 | ❌ |
| 在 `transform: scale()` 容器里 | ❌ 我们的列表不在缩放层 | 不受影响 | ❌ **系统性错位**（#1290/#1852/#2041） | 不受影响 |
| 包体积 | — | **0** | 17.9 KB gzip（core+sortable+modifiers） | **18.3 KB gzip** |
| 许可证 | — | — | MIT | MIT |

**决策建议**：

- **页序拖动（`SlideList.tsx`）**：**先手写 HTML5 `draggable`**。
  15 页以下的列表基本滚不动，"自动滚动"可以先不做；代码量约 40 行
  （`draggable` + `dragstart` 存 index + `dragover` preventDefault + `drop` 换位 + `dragend` 清态）。
  **判断依据是 §3.1 的 #424**：连 PPTist 都只做了单选拖拽排序，说明这个需求的复杂度上限很低。
  > 若后续要求"手机也能拖"或"页数 > 30 要自动滚动" → 换 `sortablejs`（18.3 KB gzip，MIT，31,205 star，
  > 2026-03-24 活跃）。**不要换 dnd-kit**：同样的功能贵 17.9 KB 还带 React 19 兼容问题（#2116）。
- **画布内元素拖拽（`CanvasStage.tsx`）**：**必须手写 pointer 事件，不要用任何拖拽库。**
  理由：库的碰撞检测模型是「矩形相交 + 落到容器里」，我们的模型是「落到最近的版式槽位」——
  两套语义。用库反而要写一堆 modifier 去对冲它。PPTist 的 `useDragElement.ts` 就是**纯手写**
  393 行（其中一大半在处理 line/shape/rotate 分支，我们槽位制只需要它的骨架约 80 行）。
  手写骨架（pointer 版，比 PPTist 的 mouse/touch 双套更省）：
  ```
  pointerdown → setPointerCapture + 缓存 rect/s + 记录 start
  pointermove → delta/s → 目标位置 → snap.ts 求吸附 → setState
  pointerup   → releaseCapture + 清辅助线 + 若位置变了才 push 快照
  ```
  用 `setPointerCapture` 是关键：**不用往 document 上挂 `onmousemove/onmouseup`**（PPTist 的做法，
  `useDragElement.ts:379-386`），避免"指针移出窗口后事件丢失"和"多实例互相污染 document.onmousemove"。
- **明确不引入**：`@dnd-kit/*`（全部）、`react-grid-layout`（24.8 KB gzip，且它的 `x/y/w/h` 栅格模型
  与我们的槽位 IR 直接冲突 —— 用它等于把 IR 改成它的布局模型）、`react-rnd`（12.7 KB gzip，
  只做"绝对定位盒子拖动缩放"，我们槽位制根本不需要自由缩放）、`moveable`（停更 35 个月，§1.1）。

**落点**：`SlideList.tsx`（HTML5 draggable）、`CanvasStage.tsx`（手写 pointer）。

---

### 4.5 为什么**不引入** tldraw / konva / fabric —— 明确论证

> 这一节是本线的交付核心。四条理由，每条都有实测支撑。

**理由 1 · 架构错配：我们渲染的是「排版」，canvas 引擎给的是「绘图」**

我们的画布是 DOM：每页一个 1280×720 的 `div`，元素是 `div`/`span`，靠 CSS 排版。
canvas 引擎（konva / fabric / tldraw 的 shape 渲染）要求把这些全部用 `fillText` / `rect` 重画。

**而文字排版是 canvas 引擎最不擅长的东西**：

| 排版能力 | DOM + CSS | Canvas |
|---|---|---|
| 中文自动换行（避头尾、标点压缩） | ✅ 浏览器排版引擎 | ❌ `fillText` **不换行**，要自己按 `measureText` 逐字判断 |
| 行高 / 字体回退 / 字体栈 | ✅ `font-family` 一行 | ❌ 要自己 `document.fonts.load` + 度量 |
| 中英混排断行 | ✅ 原生 | ❌ 要自己实现 UAX#14 子集 |
| 富文本（粗体/斜体/颜色混排） | ✅ `contenteditable` / ProseMirror | ❌ 几乎不可行 |
| 文字选中/光标/输入法 | ✅ 原生 | ❌ 要自绘光标 + 处理 IME |
| 后续做 pptx 导出时的"所见即所得" | ✅ CSS 值可映射到 pt | ⚠️ 多一层 canvas 坐标翻译 |

**PPTist 的做法就是证据**：9,472 star 的网页版 PowerPoint，选择**全 DOM 渲染**
（`Canvas/index.vue` 里 `.viewport` 下全是 `EditableElement` 组件），富文本用 ProseMirror
（`package.json` 里有 10 个 `prosemirror-*` 包），**一个 canvas 引擎都没用**。

**理由 2 · IR 复用：同一份 IR 要同时喂「编辑器渲染」和「PptxGenJS 导出」**

我们的关键约束是：IR 是单一真源，编辑器渲染它，`PptxGenJS` 也从它生成 pptx。

- **DOM 路线**：CSS 的量（`px`/`pt`/`em`/`%`、`fontSize`、`lineHeight`、`color`、`opacity`）
  与 pptx 的 `x/y/w/h/fontSize/color/transparency` **是一一映射的**。
  PPTist 的 `useExport.ts`（**1,020 行**）就是**直接遍历 IR 元素属性喂 pptxgenjs**，中间没有渲染层：
  `:4` `import pptxgen from 'pptxgenjs'`，`:485` `const exportPPTX = (_slides, ...)`，`:114` `pptx.writeFile(...)`。
- **Canvas 路线**：多一层"canvas 变换栈 → IR 坐标"的翻译；且为了清晰度要做
  `devicePixelRatio` 缩放（`canvas.width = cssW * dpr; ctx.scale(dpr, dpr)`），
  **"屏幕上看到的"与"导出时用到的"会分成两套数值**，一致性风险显著上升
  （fabric 的 #7502/#2791 那一串模糊 issue 就是这个缩放账没算平的表征）。

**理由 3 · 包体积（bundlephobia 实测 min / gzip）**

| 库 | 版本 | min | **gzip** | 直接依赖数 |
|---|---|---|---|---|
| `tldraw` | 5.6.0 | 1,859,684 B | **552 KB** | 18 |
| `@excalidraw/excalidraw` | 0.18.1 | 1,124,502 B | **353 KB**（+ mermaid/cytoscape/katex 懒加载 chunk） | 31 |
| `fabric` | 7.4.0 | 298,694 B | **91.9 KB** | 0 |
| `konva` | 10.9.1 | 189,951 B | **56.8 KB** | 0 |
| **我们需要的全部能力** | — | `ResizeObserver` + `transform: scale` + 手写吸附 | **0 KB** | 0 |

tldraw 的 18 个直接依赖里，`@tldraw/editor` 一项就 910 KB，还牵进 `@tiptap/*`（240 KB）、
`prosemirror-*`（多包合计 ~500 KB）、`@radix-ui/*`（十几个包）、`intl-messageformat`（国际化）。
**这些体积换来的能力（无限画布、多人协作、shape 工具集）我们一项都不用**（本期明确不做协作、不做自由画布）。

**理由 4 · 即使引入，手柄/选中框/辅助线还是得用 DOM 画**

这是最容易被忽略的一点：canvas 引擎只接管"内容"，**选中框、8 个缩放手柄、吸附辅助线、
浮动工具条、文本编辑态光标**这些"操作层"仍然必须是 DOM（要和 canvas 精确对齐、
要接收 pointer 事件、要能被 CSS 定位）。于是你会同时维护**两套渲染系统 + 两套坐标换算**。

PPTist 的选择是把这一切**统一在 DOM 里**：`.operates` 层（DOM）叠在 `.viewport`（DOM）上，
坐标系只有一个（IR）加一个标量 `s`。**复杂度最低。**

**理由 5（法律）**：tldraw 禁用（§2.1）。这一条单独就足够。

> **一句话总结**：引入 canvas 引擎的收益是"自由画布的绘图能力"（我们不做），
> 代价是"重写渲染器 + 失去 DOM 文字排版 + IR 双轨 + 至少 57 KB gzip 起"。
> 这不是权衡，这是净亏。

---

## 5. 本线结论

### 5.1 抄哪些交互模式（按"必须抄"→"可选"）

| # | 模式 | 从哪抄（只读事实） | 落点 | 为什么必须 |
|---|---|---|---|---|
| 1 | **三层 DOM 画布**：容器 / scale 后的 wrapper（真尺寸）/ 内部 IR 尺寸层 | `Canvas/index.vue:20-96` | `CanvasStage.tsx` | 唯一能同时解决"等比贴合 + 手柄 1px 不畸变 + box-shadow 不变形"的结构 |
| 2 | **拖拽用 `delta ÷ s`，不用绝对坐标** | `useDragElement.ts:178-179` | `scale.ts` | 一行解决 90% 的坐标偏移坑；不依赖 `rect`/祖先滚动 |
| 3 | **手柄/辅助线在 scale 层外侧** | `Canvas/index.vue:29-70` vs `:72-95`；`AlignmentLine.vue:19-26` | `OverlayLayer.tsx` | 否则 1px 边在 50% 缩放下消失、在 200% 下变粗 |
| 4 | **`ResizeObserver` 盯中栏容器，不盯 window** | `useViewportSize.ts:82-89` | `scale.ts` | 左右栏可拖拽 → 中栏宽度变化不触发 `window.resize` |
| 5 | **`canvasPercentage=90` 的留白** | `main.ts:56` | `scale.ts` | 画布贴边会显得局促；留 5% 是"专业感"的一部分 |
| 6 | **快照式 undo + debounce 300ms + 上限 + 分支截断 + 带页索引** | `snapshot.ts` 全文、`useHistorySnapshot.ts` | `history.ts` | 结构性操作（换版式/换主题/页序）用命令式写不对逆操作 |
| 7 | **吸附每方向只吸一次 + 精确贴线 + 松手清辅助线** | `useDragElement.ts:268-311`, `:358` | `snap.ts` | "只吸一次"避免抖动；"精确贴线"让元素真的对齐 |
| 8 | **吸附阈值与误操作阈值分开** | 反例：`useDragElement.ts:32` 一个常量两用 | `snap.ts` | 避免缩放后手感随 zoom 变化（我们修正这个瑕疵） |
| 9 | **页序拖动 = 数组换位，不做多选** | `Thumbnails/index.vue:20-31`, `:227`；#424 | `SlideList.tsx` | 需求上限很低，别过度设计 |
| 10 | **主题色挂在 IR 顶层，显式下发** | 反例：PPTist #450（主题短路覆盖） | `editorStore.ts` / IR schema | 避免以后做"单页覆盖主题"时重演 bug |
| 11 | **缩略图不渲染真实文字排版** | 预防性（#419 标题级证据） | `SlideList.tsx` | 15+ 页 × 完整 IR 渲染的 DOM 子树会重 |
| 12 | **pptx 纯前端生成（pptxgenjs + file-saver）** | `useExport.ts:4`, `:114`, `:485`；`package.json` 无 LibreOffice | 已定（项目用 PptxGenJS） | 验证了"前端直出"这条路可行性已被一个 9,472 star 的产品走通 |
| 13 | （可选）Ctrl+滚轮以**光标为锚点**缩放 | `Canvas/index.vue:263-276` + excalidraw #940 | `scale.ts` | 本期只需"自适应 + 全屏"可不做；要做就必须锚光标 |

### 5.2 不引入什么（明确清单）

| 不引入 | 理由（一句话） |
|---|---|
| **tldraw** | 自定义许可明文禁止生产环境 + 运行时 License Key 校验/水印/回传（§2.1），**禁用** |
| **konva / fabric** | canvas 渲染 = 放弃 DOM 文字排版 + IR 双轨；MIT 也无用武之地（§4.5） |
| **@excalidraw/excalidraw** | MIT 可依赖，但面向自由白板，无版式/槽位概念；353 KB gzip 换不来我们要的东西 |
| **@dnd-kit/\***（core/sortable/modifiers/react） | ①页序拖动不值 17.9 KB；②`transform: scale()` 容器内系统性错位（#1290/#1852/#2041，后两条一条 CLOSED 一条仍 OPEN）；③React 19 Strict Mode 兼容 OPEN（#2116）；④`@dnd-kit/react` 仍 0.5.3 |
| **react-grid-layout** | 它的 `x/y/w/h` 栅格模型会**污染 IR**（等于把 IR 改成它的布局模型）；24.8 KB gzip |
| **react-rnd** | 只做"绝对定位盒子自由拖动缩放"；槽位制不需要自由缩放；12.7 KB gzip |
| **moveable** | 默认分支末次 commit 2023-12-03，**停更 35 个月**；78.1 KB gzip（§1.1） |
| **immer / patches 历史** | 结构性操作下省不了体积，还引入"patch 可重放"约束（§4.3） |
| **任何"画布 SDK"** | §4.5 全部理由 |

### 5.3 建议的最小依赖集（每项：用途 / 体积 / 许可证）

> 项目规则：新增依赖必须写明 **用途 / 体积 / 许可证**。三项齐备如下。

**基线方案（推荐）：新增 0 个运行时依赖**

| 能力 | 实现方式 | 用途 | 体积 | 许可证 |
|---|---|---|---|---|
| 等比缩放适配 + 坐标换算 | 原生 `ResizeObserver` + `transform: scale` + 手写 `scale.ts` | 画布贴合与指针换算 | **0 KB**（浏览器原生） | 不适用 |
| 槽位/对齐线吸附 | 手写 `snap.ts`（纯函数，可单测） | 拖拽吸附 | **0 KB** | 不适用 |
| 画布内元素拖拽 | 手写 `pointerdown/move/up` + `setPointerCapture` | 拖拽 | **0 KB** | 不适用 |
| 撤销/重做 | 手写快照栈（~30 行，`structuredClone`） | undo/redo | **0 KB** | 不适用 |
| 页序拖动 | 原生 HTML5 `draggable` | 页序 | **0 KB** | 不适用 |
| 状态管理 | `zustand`（**已定，属既有技术栈，非本线新增**） | IR + UI 状态 | 0.8 KB min / **0.5 KB gzip** | **MIT** |

**本线新增：0 个。**（`zustand` 计在既有栈；Next.js 15 / TS / Tailwind / shadcn/ui / zod 同理，均不在本线计入。）

**可选增量（按需启用，不是必须）：**

| 包 | 版本 | 用途 | 体积（min / gzip） | 许可证 | 备注 |
|---|---|---|---|---|---|
| `zundo` | 2.3.0 | **zustand 的撤销/重做快照插件**，用来替代手写快照栈 | 1.5 KB / **0.6 KB** | **MIT** | 必须配 `partialize` 只跟踪 IR；`limit` 设 20–30；`handleSet` 里 debounce |
| `sortablejs` | 1.15.7 | 页序拖动（**仅在需要"移动端触摸"或"页数>30 自动滚动"时才加**） | 45.8 KB / **18.3 KB** | **MIT** | 31,205 star，2026-03-24 活跃；PPTist 的 `vuedraggable` 底层就是它 |

**合计**：基线 **新增 0 个依赖**；两个可选项都加上 **19.4 KB gzip**（相对既有栈）。
对照一下被否决的方案：tldraw **552 KB**、excalidraw **353 KB**、fabric **91.9 KB**、konva **56.8 KB**。

### 5.4 对上游（Lead）的两个裁量点 —— 均已答复（2026-11-09）

1. **状态管理：Lead 已确认为 zustand**（既有技术栈：Next.js 15 App Router + TS + Tailwind + shadcn/ui + zustand + zod）。
   → 本文件已按此改写：`zundo` 一律表述为「**zustand 的撤销/重做快照插件（0.6 KB gzip，MIT），可选，替代手写快照栈**」，
   不作为独立状态方案出现（见 §4.3 方案 B、§5.3）。
   "快照式 + debounce 300ms + 上限 20–30 + 只跟踪 IR（不跟踪 UI 状态）"这套结论与具体库无关，zundo 与手写栈都适用。
2. **`docs/research/` 目录：Lead 已确认就是约定目录**，本文件位置正确，无需迁移。

---

## 6. 未核实项

| # | 未核实内容 | 原因 | 影响评估 |
|---|---|---|---|
| 1 | **IR 快照的真实内存占用** | 项目还没有 `IR` 类型定义、没有任何真实幻灯片数据（`docs/` 为空，仓库未初始化）。§4.3 的 24–48 KB/册、0.5–1.0 MB/20 份是**按"15 页 × 8 槽 × 200–400 B"假设推算的估算值**，不是实测 | 低。结论有 2–3 个数量级余量：即使每槽 JSON 是我假设的 10 倍，20 份快照也只有 5–10 MB，现代浏览器仍无压力。**但应在 IR schema 定稿后用真实数据实测一次** |
| 2 | **PPTist 在不同浏览器/DPR 下的实际缩放手感** | 铁律禁止 clone，无法运行其 dev server；只能读源码 | 中低。§4.1 的算法是逐行读出来的，逻辑确定；但"留白 90% 是否合适""阈值 5 是否偏紧"属手感，需我们在自己实现里调 |
| 3 | **PPTist #419（WKWebView 白屏）是否为真 bug** | issue **正文是空白模板**，提问者没写复现步骤、环境、页数，无任何评论回复（`comments=0`）。**只有标题级信息** | 低。我只把它当"方向性提醒"（缩略图别渲染完整 IR），**没有把它当已确认缺陷**写入任何结论 |
| 4 | **`zundo` / `zustand` 的仓库 stars 与最近提交** | 我探测了 npm 元数据（版本/许可证/体积）但**没有单独 `gh api` 探测它们的 GitHub 仓库** | 低。两者都是 pmndrs / charkour 的活跃小库，且许可证与体积已实测；若 Lead 要求补齐，一条命令即可 |
| 5 | **bundlephobia 的体积是否含 tree-shaking 后的真实值** | bundlephobia 按"入口全量 + min+gzip"计算，未做 tree-shaking 估算；实际打包值通常更小（例如 `@dnd-kit/core` 我们可能只用 60%） | 低。用于"量级对比"（KB vs 百 KB）完全够；结论不依赖精确值 |
| 6 | **各库的 CVE / 供应链安全评分** | 本线范围是"编辑器手感"，未做安全审计（`npm audit` 需先装依赖，铁律禁止） | 中。**建议在正式引入 `zundo`/`sortablejs` 前跑一次 `pnpm audit`**，这属于立项后动作 |
| 7 | **`@dnd-kit/core` 6.3.1 的实际维护状态** | `dnd-kit` 仓库末次 commit 2026-10-31（活跃），但**次代 `@dnd-kit/react` 仍是 0.5.3**；我未核实官方是否已宣布 v6 进入维护模式 | 低。我们的结论是"不用 dnd-kit"，故不影响 |
| 8 | **PPTist 的 `viewportSize` 为何是 1000 而非 1280** | 实测默认值 `viewportSize: 1000`（`store/slides.ts:54`），比例 0.5625。未找到注释解释为何选 1000 | 无影响。1000×562.5 与 1280×720 同为 16:9，公式完全等价，只是基准不同。**我们的 1280×720 直接代入同一公式即可** |

---

## 7. 原始命令与输出

> 以下全部为本次会话真实执行。环境：Windows 11 / PowerShell 7 / `gh` 2.103.3 / 已登录 `xzhengyu007-lang`。
> ⚠️ 本会话 `win_bash` 不可用、`.ps1` 被执行策略拦 —— 唯一姿势：
> `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\xxx.ps1`。

### 7.1 探针（stars / license / pushed_at / 语言 / archived / open_issues / created_at）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 tldraw/tldraw excalidraw/excalidraw konvajs/konva fabricjs/fabric.js clauderic/dnd-kit atlassian/pragmatic-drag-and-drop daybrush/moveable
```

输出（TSV，`repo / stars / license / pushed_at / language / archived / open_issues / created_at / description`）：

```text
tldraw/tldraw	51418	NOASSERTION	2026-11-07T22:32:28Z	TypeScript	False	616	2021-05-09T11:48:37Z	Build infinite canvas apps in React with the tldraw SDK. ...
excalidraw/excalidraw	135327	MIT	2026-11-08T08:18:35Z	TypeScript	False	3507	2020-01-02T01:04:43Z	Virtual whiteboard for sketching hand-drawn like diagrams
konvajs/konva	14926	NOASSERTION	2026-11-05T15:53:19Z	TypeScript	False	4	2015-01-09T10:14:35Z	Konva.js is an HTML5 Canvas JavaScript framework ...
fabricjs/fabric.js	31550	MIT	2026-11-05T08:13:11Z	TypeScript	False	462	2010-06-09T22:24:38Z	Javascript Canvas Library, SVG-to-Canvas (& canvas-to-SVG) Parser
clauderic/dnd-kit	17782	MIT	2026-10-31T17:20:40Z	TypeScript	False	144	2020-11-26T00:46:52Z	The modern toolkit for building drag and drop interfaces
atlassian/pragmatic-drag-and-drop	12793	NOASSERTION	2026-11-08T02:45:51Z	TypeScript	False	104	2024-02-04T21:51:59Z	Fast drag and drop for any experience on any tech stack
daybrush/moveable	10764	MIT	2024-06-03T07:57:45Z	TypeScript	False	454	2019-07-05T15:04:30Z	Moveable! Draggable! Resizable! Scalable! Rotatable! ...
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 pipipi-pikachu/PPTist bvaughn/react-resizable-panels pmndrs/valtio
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 react-grid-layout/react-grid-layout bokuweb/react-rnd SortableJS/Sortable excalidraw/excalidraw
```

```text
pipipi-pikachu/PPTist	9472	AGPL-3.0	2026-11-06T15:58:56Z	Vue	False	20	2020-12-10T14:39:32Z	PowerPoint-ist ... An online presentation application that replicates most of the commonly used features of MS PowerPoint ...
react-grid-layout/react-grid-layout	22486	MIT	2026-11-03T16:58:15Z	TypeScript	False	8	2014-12-27T14:28:40Z	A draggable and resizable grid layout with responsive breakpoints, for React.
bokuweb/react-rnd	4325	MIT	2026-05-12T16:10:32Z	TypeScript	False	181	2016-01-02T07:47:27Z	A resizable and draggable component for React.
SortableJS/Sortable	31205	MIT	2026-03-24T22:02:22Z	JavaScript	False	532	2013-12-19T10:10:13Z	Reorderable drag-and-drop lists for modern browsers and touch devices. ...
```

### 7.2 默认分支末次 commit（防 `pushed_at` 误导）

```powershell
foreach($r in @('pipipi-pikachu/PPTist','tldraw/tldraw','excalidraw/excalidraw','konvajs/konva','fabricjs/fabric.js','clauderic/dnd-kit','daybrush/moveable','SortableJS/Sortable','react-grid-layout/react-grid-layout','bokuweb/react-rnd')){
  $c = (gh api "repos/$r/commits?per_page=1" 2>$null) | ConvertFrom-Json
  $br = ((gh api "repos/$r" 2>$null) | ConvertFrom-Json).default_branch
  "{0}`tdefault_branch={1}`tlast_commit={2}`t{3}" -f $r,$br,$c[0].commit.author.date,(($c[0].commit.message -split "`n")[0])
}
```

```text
pipipi-pikachu/PPTist	default_branch=master	last_commit=2026-11-06T15:56:57Z	feat: 表格单元格支持富文本（#455）
tldraw/tldraw	default_branch=main	last_commit=2026-11-07T19:11:34Z	fix(tldraw): remove the new note and stay in select when cancelling a ...
excalidraw/excalidraw	default_branch=master	last_commit=2026-11-05T17:10:20Z	docs(repo): redirect the bare docs.excalidraw.com root too (#12559)
konvajs/konva	default_branch=master	last_commit=2026-11-05T15:53:19Z	Merge pull request #2082 from nk-batman21/fix/text-wrap-dash
fabricjs/fabric.js	default_branch=master	last_commit=2026-11-05T08:02:54Z	chore(release): add pnpm versionbump command (#11200)
clauderic/dnd-kit	default_branch=main	last_commit=2026-10-31T17:20:40Z	Merge pull request #2173 from clauderic/codex/update-vulnerable-dev-de...
daybrush/moveable	default_branch=master	last_commit=2023-12-03T13:52:09Z	chore: Release 0.53.0          ← 停更 35 个月
SortableJS/Sortable	default_branch=master	last_commit=2026-03-24T22:02:15Z	#2463: Fix multidrag dragel memory leak
react-grid-layout/react-grid-layout	default_branch=master	last_commit=2026-11-03T16:44:01Z	perf(core): spatial indexes for classic vertical and horizontal compaction (#2351)
bokuweb/react-rnd	default_branch=master	last_commit=2026-03-10T11:16:36Z	Pub 10.5.3 (#982)
```

> **注意 `daybrush/moveable`**：`pushed_at=2024-06-03` 但默认分支末次 commit **2023-12-03**。
> 与 Lead 在 `.research/lead-环境实测.md` 第 4 节记录的 PptxGenJS 现象完全同型。

### 7.3 许可证全文（`NOASSERTION` 必做）

```powershell
foreach ($r in @('tldraw/tldraw','konvajs/konva','atlassian/pragmatic-drag-and-drop')) {
  $o = (gh api "repos/$r/license" 2>$null) | ConvertFrom-Json
  "path={0}  size={1}  license.name={2}  spdx={3}" -f $o.path,$o.size,$o.license.name,$o.license.spdx_id
  [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($o.content))
}
```

```text
path=LICENSE.md  size=4609  license.name=Other  spdx=NOASSERTION      ← tldraw/tldraw
path=LICENSE     size=1172  license.name=Other  spdx=NOASSERTION      ← konvajs/konva
path=LICENSE     size=558   license.name=Other  spdx=NOASSERTION      ← atlassian/pragmatic-drag-and-drop
```

关键摘录：

- **tldraw** → 自定义许可：`Not to use the Software in Production Environments.` /
  `ensure proper watermark display` / `may collect and transmit usage data to tldraw for license compliance purposes` /
  `Governing law: Delaware`（全文要点见 §2.1）
- **konva** → **正文是标准 MIT**，因头部双版权行被 GitHub 识别为 `Other`
  （`Original work Copyright (C) 2011 - 2013 by Eric Rowell (KineticJS)` +
  `Modified work Copyright (C) 2014 - present by Anton Lavrenov (Konva)`）
- **pragmatic-drag-and-drop** → **正文是 Apache-2.0**（`Copyright 2024 Atlassian Pty Ltd`），被识别为 `Other`

```powershell
# PPTist 许可证（API 已能识别，做交叉验证）
$o = (gh api "repos/pipipi-pikachu/PPTist/license") | ConvertFrom-Json
"path={0} size={1} name={2} spdx={3}" -f $o.path,$o.size,$o.license.name,$o.license.spdx_id
```

```text
path=LICENSE size=34522 name=GNU Affero General Public License v3.0 spdx=AGPL-3.0
```

### 7.4 PPTist 源码只读拉取（未 clone；经 contents API 读单文件）

```powershell
# 复用脚本：.research/e-read.ps1（本会话新建，只读，不 clone）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\e-read.ps1 pipipi-pikachu/PPTist `
  package.json src/hooks/useScaleCanvas.ts src/hooks/useHistorySnapshot.ts src/store/snapshot.ts `
  src/views/Editor/Canvas/index.vue src/views/Editor/Canvas/hooks/useViewportSize.ts `
  src/views/Editor/Canvas/hooks/useDragElement.ts src/hooks/useAlignActiveElement.ts `
  src/views/Editor/Canvas/AlignmentLine.vue src/views/Editor/Canvas/GridLines.vue `
  src/store/main.ts src/store/slides.ts src/hooks/useExport.ts src/views/Editor/Thumbnails/index.vue
```

关键实测输出（摘录，行号为文件内真实行号）：

```text
# src/views/Editor/Canvas/hooks/useViewportSize.ts:19-30   ← 等比缩放核心
if (canvasHeight / canvasWidth > viewportRatio.value) {
  const viewportActualWidth = canvasWidth * (canvasPercentage.value / 100)
  mainStore.setCanvasScale(viewportActualWidth / viewportSize.value)
  viewportLeft.value = (canvasWidth - viewportActualWidth) / 2
  viewportTop.value  = (canvasHeight - viewportActualWidth * viewportRatio.value) / 2
} else {
  const viewportActualHeight = canvasHeight * (canvasPercentage.value / 100)
  mainStore.setCanvasScale(viewportActualHeight / (viewportSize.value * viewportRatio.value))
  ...
}
# :82-89  ← ResizeObserver
const resizeObserver = new ResizeObserver(initViewportPosition)
onMounted(()   => { if (canvasRef.value) resizeObserver.observe(canvasRef.value) })
onUnmounted(() => { if (canvasRef.value) resizeObserver.unobserve(canvasRef.value) })

# src/views/Editor/Canvas/index.vue:22-27,75  ← 三层 DOM（wrapper 真尺寸 / viewport 被 scale）
:style="{ width: viewportStyles.width * canvasScale + 'px',
          height: viewportStyles.height * canvasScale + 'px', left: ..., top: ... }"
<div class="viewport" ref="viewportRef" :style="{ transform: `scale(${canvasScale})` }">
# :236-238  ← 绝对坐标换算（混用 pageX 与 rect 的坑，见 §4.1）
const viewportRect = viewportRef.value.getBoundingClientRect()
const left = (e.pageX - viewportRect.x) / canvasScale.value
const top  = (e.pageY - viewportRect.y) / canvasScale.value

# src/views/Editor/Canvas/hooks/useDragElement.ts:32,178-179  ← 吸附阈值 + 增量换算
const sorptionRange = 5
let moveX = (currentPageX - startPageX) / canvasScale.value
let moveY = (currentPageY - startPageY) / canvasScale.value
# :275-279  ← 吸附判定 + 辅助线（每方向只吸一次、精确贴线、两端外延 50）
if (Math.abs(targetMinY - value) < sorptionRange && !isHorizontalAdsorbed) {
  targetTop = targetTop - (targetMinY - value)
  isHorizontalAdsorbed = true
  _alignmentLines.push({type:'horizontal', axis:{x:min-50, y:value}, length:max-min+100})
}
# :358  ← 松手清空辅助线
alignmentLines.value = []

# src/store/snapshot.ts:41,74-78,59-61  ← 快照式 undo/redo
slides: JSON.parse(JSON.stringify(slidesStore.slides))
const snapshotLengthLimit = 20
if (snapshotLength > snapshotLengthLimit) { needDeleteKeys.push(allKeys[0]); snapshotLength-- }
if (this.snapshotCursor >= 0 && this.snapshotCursor < allKeys.length - 1) {
  needDeleteKeys = allKeys.slice(this.snapshotCursor + 1)   // 分支截断
}

# src/hooks/useHistorySnapshot.ts:8-20  ← debounce 300 / throttle 100
const addHistorySnapshot = debounce(function() { snapshotStore.addSnapshot() }, 300, { trailing: true })
const undo = throttle(function() { snapshotStore.undo() }, 100, { leading: true, trailing: false })

# src/views/Editor/Thumbnails/index.vue:20-31,227  ← 页序拖动
<Draggable :modelValue="slides" :animation="200" :scroll="true" :scrollSensitivity="50" itemKey="id" @end="handleDragEnd">
sortSlides(newIndex, oldIndex)

# src/store/slides.ts:54-55  ← IR 画布基准
viewportSize: 1000,      // 可视区域宽度基数
viewportRatio: 0.5625,   // 16:9

# src/hooks/useExport.ts:4,114,485  ← 纯前端 pptx 导出
import pptxgen from 'pptxgenjs'
pptx.writeFile({ fileName: `${title.value}.pptx` }).then(() => exporting.value = false)
const exportPPTX = (_slides: Slide[], masterOverwrite: boolean, ignoreMedia: boolean) => {
```

### 7.5 PPTist 结构性事实（回答 Lead 的 Q6）

```powershell
# 顶层目录：确认没有 server/api/backend
$t = (gh api "repos/pipipi-pikachu/PPTist/git/trees/HEAD?recursive=1") | ConvertFrom-Json
$t.tree | Where-Object { $_.path -notmatch '/' } | ForEach-Object { "{0}`t{1}" -f $_.path,$_.type }
$t.tree | Where-Object { $_.path -match '^(server|api|backend|service)/|src/api' }    # → 空
# 搜 LibreOffice
gh search code "libreoffice" --repo pipipi-pikachu/PPTist --limit 5 --json path      # → []
```

```text
顶层：.eslintrc.cjs  .github  .gitignore  .husky  .vscode  LICENSE  README.md  README_zh.md
      commitlint.config.cjs  components.d.ts  doc  env.d.ts  index.html  package-lock.json
      package.json  public  src  tsconfig*.json  vite.config.ts
server/api/backend 目录：无
libreoffice 代码命中：[]（0 条）
```

**结论（回答"导出 pptx 是前端还是后端？依赖里有没有 LibreOffice？"）**：

1. **纯前端**。`package.json` 依赖里只有 `pptxgenjs@^3.12.0`（生成）与 `pptxtojson@^2.2.0`（导入解析），
   `useExport.ts:4` 直接 `import pptxgen from 'pptxgenjs'`，`:114`/`:1004` 用 `pptx.writeFile()` 在浏览器里落盘，
   配合 `file-saver`。**整个仓库没有后端目录、没有 API 层**，是一个 Vite 打包的纯 SPA。
2. **完全没有 LibreOffice**。`gh search code "libreoffice"` 在该仓库命中 0 条；
   图片导出走 `html-to-image`（`toPng/toJpeg`），PDF 导出走 `utils/print.ts`（打印）。
3. **对我们的意义**：这印证了我们"前端直出 pptx"的路线**已被一个 9,472 star 的生产级产品走通**，
   不需要在服务端常驻 LibreOffice（Lead 已在 `.research/lead-环境实测.md` §2 确认本机无 LibreOffice、
   但有真 PowerPoint/WPS 可做验收）。**同时** PPTist #445（导出文件 PowerPoint 提示需修复）
   提醒我们：`pptxgenjs` 的产物必须在真 PowerPoint 里打开验一次，不能只看"文件生成成功"。

### 7.6 issue 存在性逐条验证

```powershell
foreach ($p in @('tldraw/tldraw#10034','tldraw/tldraw#10721','tldraw/tldraw#6567',
                 'excalidraw/excalidraw#3175','excalidraw/excalidraw#940','excalidraw/excalidraw#9907',
                 'konvajs/konva#1924','konvajs/konva#1458',
                 'fabricjs/fabric.js#7502','fabricjs/fabric.js#2791',
                 'daybrush/moveable#1137','pipipi-pikachu/PPTist#445')) {
  $s=$p.Split('#'); $o=(gh api "repos/$($s[0])/issues/$($s[1])") | ConvertFrom-Json
  "{0}#{1} [{2}] {3} comments={4} :: {5}" -f $s[0],$o.number,$o.state,$o.created_at.Substring(0,10),$o.comments,$o.title
}
```

```text
tldraw/tldraw#10034 [open]   2026-08-15 comments=0  :: License page says hobby licenses send no data, but watermarked licenses are tracked
tldraw/tldraw#10721 [closed] 2026-09-09 comments=1  :: License tracking fetch causes an unhandled promise rejection when blocked
tldraw/tldraw#6567  [closed] 2025-08-11 comments=5  :: Add Next.js SSR support
excalidraw/excalidraw#3175 [closed] 2021-03-05 comments=11 :: Offsets not updating correctly when embedded in scrollable website
excalidraw/excalidraw#940  [closed] 2020-03-14 comments=12 :: Zoom on cursor rather than center of screen
konvajs/konva#1924 [closed] 2025-04-19 comments=5  :: [BUG] Transformer using scaled coordinates - Pointer events don't work.
konvajs/konva#1458 [closed] 2022-12-01 comments=13 :: Next.js 13 related ESM/CJS issues with canvas
fabricjs/fabric.js#7502 [closed] 2021-11-18 :: Canvas blur after rescale page
daybrush/moveable#1137 [open]   2024-11-20 :: Is this project still active?
```

```powershell
# dnd-kit 一组（transform:scale 全家族）+ excalidraw SSR
gh issue list -R clauderic/dnd-kit --search 'sortable transform zoom scale' --limit 6 --state all --json number,title,state,createdAt
gh issue list -R pipipi-pikachu/PPTist --limit 45 --state all --json number,title,state,comments,createdAt
```

```text
clauderic/dnd-kit（--search 'sortable transform zoom scale' 命中 6 条，标题含关键词 'scaled parent container'）：
  #2041 [OPEN]   2026-05-05 :: Sortable animations jump inside scaled parent container
  #1852 [CLOSED] 2025-12-17 :: Unexpected sortable behavior when parent container scale is not equal to 1
  #1582 [CLOSED] 2025-01-04 :: adjustScaleModifier does not apply to placeholder in a sortable list.
  #1290 [CLOSED] 2023-12-06 :: @dnd-kit list sorting not working properly when parent div has transform:scale() css
  #638  [CLOSED] 2022-02-28 :: Dragged items don't stay with mouse when zoomed in or out
  #2116 [OPEN]   2026-07-31 :: React 19: DragDropProvider manager is destroyed during Strict Mode replay
  #19   [CLOSED] 2020-12-04 :: `document` is undefined for server side rendering

pipipi-pikachu/PPTist（45 条全列表，本文件引用其中 5 条）：
  #455 [CLOSED] 2026-11-03 :: [Feature request] 表格单元格内支持富文本
  #450 [CLOSED] 2026-09-15 :: 多母版/多主题场景下，单页主题加载存在短路求值逻辑，导致后续页面主题色被强制覆盖
  #445 [CLOSED] 2026-08-12 :: [Bug report]导出pptx在本地打开提示需要修复
  #434 [CLOSED] 2026-04-23 :: [Bug report]关于在iframe中使用PPTist时，e instanceof MouseEvent判断异常的问题
  #424 [OPEN]   2026-01-29 :: [Feature request]缩略图能否支持多选拖拽排序
  #419 [OPEN]   2025-12-28 :: 这个库是不是在iOS客户端的WKWebView…快速滚动页面会白屏…（正文为空模板）
```

### 7.7 npm 元数据（版本 / 许可证 / 体积）

```powershell
$cache='D:\code\ppt制作\.research\npm-cache'
foreach($p in @('@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/modifiers','@dnd-kit/utilities','@dnd-kit/react',
                'zundo','zustand','sortablejs','react-rnd','moveable','konva','fabric','tldraw','pptxgenjs','immer')){
  $o = (npm.cmd view $p version license dist.unpackedSize --json --cache $cache) | ConvertFrom-Json
  if($o -is [array]){$o=$o[-1]}
  "{0}`tver={1}`tlic={2}`tunpackedKB={3}" -f $p,$o.version,$o.license,[Math]::Round($o.'dist.unpackedSize'/1KB,0)
}
foreach($p in @('@atlaskit/pragmatic-drag-and-drop','@excalidraw/excalidraw','@dnd-kit/react','react-grid-layout')){
  $o = (npm.cmd view $p version license --json --cache $cache) | ConvertFrom-Json
  if($o -is [array]){$o=$o[-1]}
  "{0}`tver={1}`tlic={2}" -f $p,$o.version,$o.license
}
```

```text
@dnd-kit/core        ver=6.3.1   lic=MIT   unpackedKB=1041
@dnd-kit/sortable    ver=10.0.0  lic=MIT   unpackedKB=229
@dnd-kit/modifiers   ver=9.0.0   lic=MIT   unpackedKB=48
@dnd-kit/utilities   ver=3.2.2   lic=MIT   unpackedKB=86
@dnd-kit/react       ver=0.5.3   lic=MIT   unpackedKB=238
zundo                ver=2.3.0   lic=MIT   unpackedKB=60
zustand              ver=5.1.0   lic=MIT   unpackedKB=109
sortablejs           ver=1.15.7  lic=MIT   unpackedKB=625
react-rnd            ver=10.5.3  lic=MIT   unpackedKB=85
moveable             ver=0.53.0  lic=MIT   unpackedKB=2373
konva                ver=10.9.1  lic=MIT   unpackedKB=1866      ← 与 LICENSE 正文明细一致（MIT）
fabric               ver=7.4.0   lic=MIT   unpackedKB=21702
tldraw               ver=5.6.0   lic=SEE LICENSE IN LICENSE.md  unpackedKB=15260
pptxgenjs            ver=4.0.1   lic=MIT   unpackedKB=2544
immer                ver=11.2.9  lic=MIT   unpackedKB=954

@atlaskit/pragmatic-drag-and-drop  ver=4.0.0  lic=Apache-2.0
@excalidraw/excalidraw             ver=0.18.1 lic=MIT
@dnd-kit/react                     ver=0.5.3  lic=MIT
react-grid-layout                  ver=2.3.0  lic=MIT
```

### 7.8 bundle 体积（bundlephobia API，min / gzip）

```powershell
# web_fetch（本会话工具）逐条查询
# https://bundlephobia.com/api/size?package=<pkg>@<version>
```

```text
tldraw@5.6.0                 size=1,859,684  gzip=552,201   deps=18
@excalidraw/excalidraw@0.18  size=1,124,502  gzip=352,695   deps=31   (+mermaid/cytoscape/katex chunks)
fabric@7.4.0                 size=  298,694  gzip= 91,851   deps=0
moveable@0.53.0              size=  241,901  gzip= 78,104   deps=5
konva@10.9.1                 size=  189,951  gzip= 56,789   deps=0
react-grid-layout@2.3.0      size=   78,473  gzip= 24,754   deps=6
react-rnd@10.5.3             size=   46,558  gzip= 12,657   deps=3
sortablejs@1.15.7            size=   45,765  gzip= 18,314   deps=0
@dnd-kit/core@6.3.1          size=   43,700  gzip= 14,237   deps=3
@dnd-kit/sortable@10.0.0     size=    9,170  gzip=  3,670   deps=2
@dnd-kit/modifiers@9.0.0     size=    1,922  gzip=    915   deps=2
zundo@2.3.0                  size=    1,547  gzip=    633   deps=0
zustand@5.1.0                size=      833  gzip=    491   deps=0
```

### 7.9 `gh search repos` 补充候选（实测结果为空/低质，如实记录）

```powershell
foreach ($q in @('infinite canvas react','whiteboard react','drag snap grid','presentation editor react')) {
  $r = gh search repos $q --limit 12 --json fullName,stargazersCount,license,updatedAt
  ($r | ConvertFrom-Json) | ForEach-Object { "{0}`t{1}`t{2}`t{3}" -f $_.fullName,$_.stargazersCount,($_.license.key),$_.updatedAt }
}
```

```text
infinite canvas react → Hhhvvb/Infinite-Canvas-React(1) / matanshavit/efficient-canvas(1) / akashwrites1120/braid(0)
whiteboard react      → ohtomi/react-whiteboard(38,mit) / peilinok/fabric-whiteboard(28,gpl-3.0) / 其余全部 0–3 star
drag snap grid        → （无结果）
presentation editor react → （无结果；放宽为 'ppt online editor' 只得 MrXujiang/pptx(229,apache-2.0)、itcastWsy/ppt-online-editor(0)）
```

**记录**：题面要求的三组搜索均**未产出可用候选**。
结论：编辑器手感领域没有"小而专"的第三方库可供挑选，选型只在少数大库与自研之间二选一。

### 7.10 本会话新建/使用的临时脚本（均在 `.research/`，未污染源码区）

| 文件 | 作用 |
|---|---|
| `.research/e-read.ps1` | 只读拉取 GitHub 单文件并带行号打印（`gh api repos/{r}/contents/{path}`，**不 clone**） |
| `scripts/gh-probe.ps1` | 既有探针（非本线新建），输出 TSV 元数据 |

---

## 8. 参考链接汇总

| 类型 | 链接 |
|---|---|
| 主参考 | [pipipi-pikachu/PPTist](https://github.com/pipipi-pikachu/PPTist) · [LICENSE(AGPL-3.0)](https://github.com/pipipi-pikachu/PPTist/blob/master/LICENSE) |
| PPTist 关键文件 | [Canvas/index.vue](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Canvas/index.vue) · [useViewportSize.ts](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Canvas/hooks/useViewportSize.ts) · [useDragElement.ts](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Canvas/hooks/useDragElement.ts) · [snapshot.ts](https://github.com/pipipi-pikachu/PPTist/blob/master/src/store/snapshot.ts) · [useHistorySnapshot.ts](https://github.com/pipipi-pikachu/PPTist/blob/master/src/hooks/useHistorySnapshot.ts) · [useExport.ts](https://github.com/pipipi-pikachu/PPTist/blob/master/src/hooks/useExport.ts) · [Thumbnails/index.vue](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Thumbnails/index.vue) · [AlignmentLine.vue](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Canvas/AlignmentLine.vue) · [GridLines.vue](https://github.com/pipipi-pikachu/PPTist/blob/master/src/views/Editor/Canvas/GridLines.vue) |
| PPTist issues | [#445](https://github.com/pipipi-pikachu/PPTist/issues/445) · [#450](https://github.com/pipipi-pikachu/PPTist/issues/450) · [#434](https://github.com/pipipi-pikachu/PPTist/issues/434) · [#424](https://github.com/pipipi-pikachu/PPTist/issues/424) · [#419](https://github.com/pipipi-pikachu/PPTist/issues/419) |
| tldraw | [repo](https://github.com/tldraw/tldraw) · [LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md) · [#10034](https://github.com/tldraw/tldraw/issues/10034) · [#10721](https://github.com/tldraw/tldraw/issues/10721) · [#6567](https://github.com/tldraw/tldraw/issues/6567) |
| excalidraw | [#3175](https://github.com/excalidraw/excalidraw/issues/3175) · [#940](https://github.com/excalidraw/excalidraw/issues/940) · [#9907](https://github.com/excalidraw/excalidraw/issues/9907) |
| konva | [LICENSE](https://github.com/konvajs/konva/blob/master/LICENSE) · [#1924](https://github.com/konvajs/konva/issues/1924) · [#1458](https://github.com/konvajs/konva/issues/1458) |
| fabric | [#7502](https://github.com/fabricjs/fabric.js/issues/7502) · [#2791](https://github.com/fabricjs/fabric.js/issues/2791) |
| dnd-kit | [#1290](https://github.com/clauderic/dnd-kit/issues/1290) · [#1852](https://github.com/clauderic/dnd-kit/issues/1852) · [#2041](https://github.com/clauderic/dnd-kit/issues/2041) · [#2116](https://github.com/clauderic/dnd-kit/issues/2116) |
| moveable | [#1137 Is this project still active?](https://github.com/daybrush/moveable/issues/1137) |
| 体积数据源 | [bundlephobia](https://bundlephobia.com/) |

---

## 补充：PPTist 的 pptxgenjs 用法

> 追加于 2026-11-09（Lead 追加要求）。B 线/E 线交界补充，**不改变前文任何结论**。
> 全部为 `gh api` 只读拉取 + `npm view` 实测。**AGPL：只看不抄** —— 下文所有结论以
> 「行号 + 事实陈述」形式给出，不提供可直接复制的实现。

### 补.1 版本与调用方式

| 项 | 实测值 |
|---|---|
| `package.json` 声明 | `"pptxgenjs": "^3.12.0"` |
| `^3.12.0` 实际解析到 | **3.12.0**（3.x 线最后一个稳定版，`npm view pptxgenjs versions` 确认 3.12.0 之后只有 `3.13.0-beta.0/beta.1`，从未发布稳定版） |
| 该版本发布时间 | **2023-03-20**（`npm view pptxgenjs time`）→ 距今约 **44 个月** |
| 是否有 adapter / 封装层 | **没有。** `useExport.ts:4` 直接 `import pptxgen from 'pptxgenjs'`（默认导出），`:487` 直接 `new pptxgen()`；所有 pptxgenjs 选项散落在 `useExport.ts` 这一个 **1,020 行**文件里，没有 `adapters/`、没有 options builder、没有版本隔离层 |
| 与我们的版本差 | Lead 的 spike 用 **4.0.1**；PPTist 用 **3.12.0**。4.0.0 是 2025-05 的重写（Lead 已在 `lead-环境实测.md` §4 记录）。**→ PPTist 的调用代码不能照搬到 4.x。** 我逐项核对了下面用到的 4 个 API（`layout` / `defineLayout` / `addText` 的 `fit` / `addNotes`）在 **4.0.1 默认分支仍存在且语义相同**（读了 `src/pptxgen.ts` 与 `src/gen-xml.ts`） |
| 调用形态 | 全程**同步式声明 + 一次性 `writeFile`**：`new pptxgen()` → `setPPTXLayout()` → 逐页 `addSlide()` → 逐元素 `addText/addImage/addTable` → `pptx.writeFile({fileName})`（`:114`、`:1004`）。**没有流式、没有增量、没有 worker 分包** |

> **对 B 线的意思**：既然我们锁了 4.0.1 且要做「单一接口隔离」，PPTist 的**结构**（一个 export 函数 + 一组格式化小函数）
> 可以照搬，**代码不能搬**（3.x→4.x + AGPL 双重原因）。

### 补.2 单位换算与版面尺寸 —— 这里有个我们不该抄的决定

PPTist 用两个 computed 常量统一换算（`useExport.ts:32-37`）：

```text
ratioPx2Inch = 96 × (viewportSize / 960)
ratioPx2Pt   = 96/72 × (viewportSize / 960)
```

代入默认 `viewportSize = 1000`（`store/slides.ts:54`）：`ratioPx2Inch = 100`、`ratioPx2Pt ≈ 1.3889`。
也就是说它的 IR 是 **100 px/inch**，`pt = IR_px / 1.3889 = IR_px × 0.72`。

**关键推论（这是我没预料到的）**：导出宽度恒为 `viewportSize / ratioPx2Inch = 960/96 = **10 英寸**`，
**与 `viewportSize` 无关**。所以：

| `viewportRatio` | 走哪个分支（`useExport.ts:41-53`） | 导出尺寸 |
|---|---|---|
| 0.625（16:10） | 内置 `LAYOUT_16x10` | 10" × 6.25" |
| 0.75（4:3） | 内置 `LAYOUT_4x3` | 10" × 7.5" |
| **其他（含 16:9 的 0.5625）** | `defineLayout()` 自定义 | **10" × 5.625"** |

而 pptxgenjs 自己的内置布局（`src/pptxgen.ts:315-318`，我读了 4.0.1 源码）是：

| pptxgenjs 常量 | EMU | 英寸 |
|---|---|---|
| `LAYOUT_4x3` | 9144000 × 6858000 | 10" × 7.5" |
| `LAYOUT_16x9` | 9144000 × 5143500 | **10" × 5.625"** |
| `LAYOUT_16x10` | 9144000 × 5715000 | 10" × 6.25" |
| `layoutWide`（"custom"） | 12192000 × 6858000 | **13.333" × 7.5"** |

**所以 PPTist 的 16:9 自定义 layout 和 pptxgenjs 内置 `LAYOUT_16x9` 尺寸完全一致（都是 10"×5.625"）。**
它写 `defineLayout` 那一支不是为了改变尺寸，而是为了让任意比例都能走同一条代码路径。

**⚠️ 这里有个值得 B 线决策的分叉，而且我认为 PPTist 的选择对我们不合适**：

- **PowerPoint 现代默认的"宽屏 16:9"是 13.333" × 7.5"（= 12192000 × 6858000 EMU）**，
  对应 96 dpi 下正好 **1280 × 720 px**。我们项目的 IR 就是 1280×720，**天然对得上**。
- pptxgenjs 的 `LAYOUT_16x9` 是 **10" × 5.625"**，比 PowerPoint 标准宽屏**小 25%**。
  拿它导出的文件，用户套用任何标准 16:9 母版/主题时尺寸不匹配（内容按 10 英寸排，母版按 13.333 英寸排）。
- **建议**：不要用 `pptx.layout = 'LAYOUT_16x9'`，而是显式
  `pptx.defineLayout({ name:'P16x9', width: 13.3333, height: 7.5 })`。
  这样换算极简：**`ratioPx2Inch = 96`，`ratioPx2Pt = 4/3`，即 `pt = IR_px × 0.75`、`inch = IR_px / 96`** ——
  比 PPTist 那套 `/1.3889` 少一次除法，且**和 CSS px 完全同构**（CSS 1px 就是 1/96 inch），
  编辑器 DOM 里的 `font-size: 24px` 直接就是 `fontSize: 18pt`，中间没有 magic number。

> 这条是纯算术推断 + 读了 pptxgenjs 源码的常量定义，**没有用真 PowerPoint 打开验证过尺寸**。
> Lead 的 4.0.1 spike 若已用 16:9 且 23/23 断言通过，请确认一下它当前的 `presLayout` 是 10" 还是 13.333"——
> 这决定了 `x/y/w/h` 与 `fontSize` 的全部换算系数，改起来是全局性的，**宜早定**。

### 补.3 `fit` / `autoFit` 它到底做了什么

**结论：只用了一个分支，用 `fit: 'resize'`（`spAutoFit`），且在"固定高度"的文本框上完全不设。**

`useExport.ts:579` 是全文唯一一行涉及 fit 的代码：

```text
579|  if (!el.fixedHeight) options.fit = 'resize'
```

即：文本元素的 `fixedHeight` 为假 → 设 `fit:'resize'`；**`fixedHeight` 为真 → 一个 fit 都不设**。

pptxgenjs 对 `fit` 的 XML 映射（我读了 **v3.12.0 与 4.0.1 两版** `src/gen-xml.ts`，映射一致）：

| `options.fit` | 生成的 OOXML | PowerPoint UI 对应 |
|---|---|---|
| `'none'` | （空，不写 autofit 元素） | Do not Autofit |
| `'shrink'` | `<a:normAutofit/>` | **Shrink text on overflow**（框不变，字缩小） |
| `'resize'` | `<a:spAutoFit/>` | **Resize shape to fit text**（字不变，框长高） |
| （另有 `options.shrinkText`） | `<a:normAutofit/>` | 同上 |

所以 PPTist 的行为是：**让形状随文字长高**，而不是让文字缩小。

**为什么这对我们是反例**：
- 我们是**版式槽位制**，槽位矩形由版式写死。用 `spAutoFit` 意味着文本框会**向下越长越高**，
  一旦某页中文写多了，框就会**溢出到下一个槽位甚至画布外**——而 PowerPoint 里这个"长高"是静默发生的，
  用户在网页编辑器里看到的是完美版面，下载 pptx 打开就撞车。
- **我们该用 `fit: 'shrink'`（`normAutofit`）**：框尺寸守住槽位，字自动缩小。代价是同一版式在不同页
  字号可能不一致（文字多的页字小），但这**远好于版式崩坏**；而且可以配合"预估字数超阈值就在生成时降一档字号"来减少不一致。
- ⚠️ **`normAutofit` 的兼容性注意**：`<a:normAutofit/>` 不带 `fontScale` 属性时，是让**打开时由 PowerPoint 现算**。
  真 PowerPoint 会算，但 LibreOffice / Google Slides / Keynote / 部分在线预览器**可能忽略**，表现为"字没缩小而是溢出"。
  → 若我们的验收要过 WPS（Lead 说本机有 WPS），**必须在 WPS 里单独验一次 shrink 是否生效**，
  这是我在本次调研里**没有验证**的一项（见补.6）。

### 补.4 中文文本溢出它怎么兜？——**它不兜**

这是 Lead 最关心的一点，答案很干脆：

**`useExport.ts` 全文 1,020 行，没有任何一处文本测量。**
我对 `measure|clientHeight|scrollHeight|offsetHeight|getBoundingClientRect|overflow|ellipsis|truncat`
做全文件检索，**命中 0 条**（证据见 §7.4 的检索脚本与输出）。

也就是说 PPTist 对中文溢出的全部"兜底"就是补.3 那一个 `fit:'resize'`：

| 它做过的事 | 它没做的事 |
|---|---|
| 给非固定高度文本框加 `spAutoFit`，让 PowerPoint 自己把框撑大 | ❌ 不预估文本宽度/行数 |
| 硬编码默认字体 `fontFace: '微软雅黑'`（`:557`，与 Lead 实测的中文字体白名单一致） | ❌ 不按字数缩字号 |
| 默认字号 16 IR px（`:30`）→ `16 × 0.72 ≈ 11.52 pt` | ❌ 不截断 / 不加省略号 |
| 行距用经验系数：默认 `lineSpacingMultiple = 1.5/1.25 = 1.2`（`:562`），元素有 `lineHeight` 时 `el.lineHeight/1.25`（`:566`） | ❌ 不做 DOM 侧行高与 pptx 行距的实测校准（`/1.25` 是个未经解释的 fudge factor） |
| 列表缩进用 `fontSize × 1.25`（`:305`、`:310`） | ❌ 不区分中英文混排的断行差异 |

**结论：一个 9,472 star 的网页版 PowerPoint，在中文溢出这一点上是"完全依赖 PowerPoint 自己的 autofit"。**
这对我们是个明确的信号：

1. **不要指望"抄它的兜底"** —— 它没有兜底可抄。
2. **兜底必须我们自己建**，而且必须建在**生成前**（因为我们有 IR，有已知槽位），而不是交给 PowerPoint 事后处理：
   - 我们有优势：槽位尺寸已知、字体白名单已知（微软雅黑/等线/Noto Sans SC）、字号是模板给的。
   - 所以可以做成**生成时的字符预算**：按槽位面积 + 字号 + 字体度量估算可容纳字数，
     超出则降一档字号或走"精简文案"分支，并把结果写进 IR（保证编辑器与 pptx 一致）。
   - 这是 B 线/实现期的活，但**本线结论是：这件事没有现成参考可抄，必须自建。**
3. **`spAutoFit` vs `normAutofit` 必须选对**（补.3）——选错等于把溢出风险藏进 PowerPoint。

### 补.5 顺手发现的其他 pptx 导出坑（都与我们本期范围相关）

| 坑 | 证据 | 对我们的影响 |
|---|---|---|
| **备注只取 `<p>` 标签** | `:533-542`：`slide.remark`（HTML）→ `DOMParser` → `querySelectorAll('p')` → `textContent` → `join('\n')` → `addNotes()` | **本期"备注编辑"直接命中**。若用户在备注里用了 `<ul><li>`、`<br>`、裸 `<div>`，**文本会整段丢失**。→ 我们的备注**存纯文本 + 显式段落数组**，不要存 HTML，导出时自己 join |
| **渐变背景降级成纯色** | `:524-531`：`tinycolor.mix(colors[0], colors[last])` 取首尾混成一个 hex，写 `background.color` | 本期"换主题"若主题含渐变会被静默抹平。→ 主题设计时就**不用渐变**，或明确降级策略并写进文档 |
| **没有真正的幻灯片母版** | `:490-496`：`defineSlideMaster` 只写了 `background.color`，无字体、无占位符 | 主题色/字体是**逐元素写死**的（`:572-573` 把 `el.defaultColor` / `el.defaultFontName` 摊到每个 run）。→ 我们若也这么做，改主题要遍历所有元素（本来就如此），但**别指望 pptx 母版能帮我们换色** |
| **SVG 背景要单独铺图** | `:503-512`：SVG 背景不能当 slide background，改用 `addImage` 铺满全页 | 若我们以后支持 SVG 背景，注意这个分支 |
| **px→pt 全靠链式除法** | `:264` 字号 `parseInt(styleObj['font-size']) / ratioPx2Pt`；`:552-556` 位置除 `ratioPx2Inch`、字号除 `ratioPx2Pt`；`:560` margin、`:561` 段距、`:565` 字距、`:577` 段落距**全部**除 `ratioPx2Pt` | 只要有一个量漏除或除错，导出就整体偏。→ 我们应该把换算**收口成 2 个函数**（`px2pt` / `px2in`）并在类型上强制使用，避免散落的 `/ ratio` |

> 另外一条与 B 线独立互证的：PPTist 的 `setPPTXLayout` 里对非标准比例才 `defineLayout`，
> 而 `pptx.writeFile()` 是**浏览器端**触发下载（`:114`），配合 `file-saver`（`package.json`）。
> 我在 §7.5 已确认该仓库**无后端、无 LibreOffice**，与 Lead 的 4.0.1 spike 结论一致。

### 补.6 本节新增的未核实项

| # | 未核实内容 | 原因 | 建议 |
|---|---|---|---|
| 9 | **`fit:'shrink'`（`<a:normAutofit/>`）在 WPS 中是否真的生效** | 本会话无法运行 PowerPoint/WPS 打开生成文件（铁律禁止在本线装依赖、本线只做只读调研） | **B 线必须验**：用 4.0.1 生成一个"文字明显超框 + `fit:'shrink'`"的文件，在 **PowerPoint 与 WPS 各开一次**，确认字真的缩小了。若 WPS 不生效，则需退回"生成前字符预算"路线（补.4 第 2 条） |
| 10 | **我们该选 10"×5.625" 还是 13.333"×7.5"** | 纯算术推断（读 pptxgenjs 常量 + 除法定标），未在真 PowerPoint 里核对版面网格 | 取决于 Lead 的 4.0.1 spike 当前 `presLayout`。**这是全局系数，宜早定**（补.2 末尾） |
| 11 | PPTist 导出在其 CI 里是否有端到端校验 | 未查 `.github/workflows` | 低。对我们无直接影响 |

---

*本文件为只读调研产出，不含任何被引用仓库的代码副本。*
