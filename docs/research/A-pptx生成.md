# A 线调研：pptx 生成库（PptxGenJS 及替代）

> 调研人：research-pptx-gen ｜ 调研时间：**2026-11-09**（墙钟）｜ 阶段 0（GitHub 选型调研），本文件不含任何产品代码
> 数据来源：本会话真实执行的 `gh api` / `gh issue list` / `npm view` 输出，原始命令与关键输出见文末「## 原始命令与输出」。
> 凡未取到或无法证实的，一律写 `未核实` 并注明原因，不做估算填充。

**一句话结论（详细论证见文末）：** PptxGenJS 主线（`gitbrent/PptxGenJS`）**踩「6 个月无提交」一票否决**，但它仍是浏览器端唯一成熟的原生 pptx 引擎，因此**否决的是「用上游原包」而不是「用这个引擎」**——主渲染器改为 **`pptxgenjs-plus`（活跃社区分支，MIT，2026-11-07 仍在发版，API 与 4.x 同源）**，并以单文件 adapter 隔离，保留回退到 `PptxGenJS@4.0.1` 与切换自研 OOXML 层的两级预案。

---

## 1. 候选对比表（固定 8 列）

主干候选（5 个）。「最近提交」列的 `pushed_at` 与「default branch 最后 commit」是两个不同事实，PptxGenJS 恰好二者不一致，故分列标注。

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件 | 坑 |
|---|---|---|---|---|---|---|---|
| **gitbrent/PptxGenJS** | 6361 | MIT | default branch(master) **2025-06-26**；`pushed_at` 2025-11-28（在 `issue-1396` 分支 WIP，非主线） | TypeScript | 浏览器/Node 双端原生 pptx 引擎。`write()` 支持 6 种 `outputType`（默认 `blob`）；自定义 `defineLayout`、`LAYOUT_WIDE`(13.33×7.5)、绝对坐标、`addNotes`、原生 chart(area/bar/bar3D/bubble/bubble3D/doughnut/line/pie/radar/scatter)、`defineSlideMaster`、图片 PNG/JPEG/SVG(base64)、`fontFace`、`fit:'shrink'`、表格、`transparency`、`rectRadius` —— 全部在 `types/index.d.ts`(73,191 B) 中实测存在 | 只需 `src/renderer/pptx/` 下 4 个文件（`renderPptx.ts` / `units.ts` / `charts.ts` / `fonts.ts`）+ `src/export/downloadPptx.ts`；DOM 预览渲染器零改动 | **已 501 天（≈16.5 个月）无主线提交**；71 个 PR 未合、309 个 open item；2026 年仍在产生「PowerPoint 要求修复」级 bug（#1546/#1534/#1466/#1444/#1443）且**零维护者回应**；`fontFace` 只写字体名不嵌字体；WPS 兼容有硬伤（#1262/#1236）；`version-4.1.0` 分支存在但从未发布 |
| **lofcz/pptxgenjs-plus** | 19 | MIT | **2026-11-07**（release v4.3.7；npm 最新 4.3.6 @2026-11-02） | TypeScript | PptxGenJS 4.x 的**社区加固分支**（非 GitHub fork，独立仓库，署名保留原作者 Brent Ely）。4.1.0→4.3.7 连续发版；CHANGELOG 自称修 PowerPoint repair/损坏（图表/占位符/备注/富文本/表格/图片/rels）、给图表标题图例轴标签补 `a:ea` 东亚字体槽、修浏览器端 `node:https` 打包冲突、opt-in `addFont` 嵌字体、`measureText`/`fitText`/`paginateTable`；自称 API 保持兼容 | 与上一行**相同文件集**（API 同源），差异仅在 `src/renderer/pptx/vendor/` 内 vendor 一份 tarball + 改 import 源 | **19 star、单人维护、bus factor = 1**；`engines: node>=24 / bun>=1.3.0`（我们若锁 Node 22 会直接装不上，需确认运行时）；npm 4.3.6 与 GitHub release v4.3.7 不同步；上述修复全为 **CHANGELOG 自述，未独立验证** |
| **hugohe3/ppt-master** | 74872 | MIT | **2026-11-08** | Python | **纯自研 OOXML 层**，不依赖 PptxGenJS/python-pptx（`python-pptx` 仅在 `svg_to_pptx.py` 里当可选依赖）：`pptx_ooxml/`（package/clone/slideshow/analyzer）、`pptx_shapes/`（`presetShapeDefinitions.xml` 538,970 B ≈526 KB + custgeom + formula）、`pptx_animations.py`(139,139 B)/`pptx_animation_presets.json`(572,130 B)、`pptx_embedded_fonts.py`、`pptx_gradient`、模板克隆（`pptx_template_import.py` + `mirror_template_materialize`）、`pptx_to_svg/`（反向渲染，含 `chart_to_svg.py` 122,156 B）、`confirm_ui/server.py`(115,933 B) 实时预览、备注转旁白（edge-tts） | **不是「改几个文件」的量级**：需新增 Python 服务 `services/pptx/`（FastAPI 包 `skills/ppt-master/scripts`）+ 前端 `src/renderer/pptx/renderViaPython.ts`（HTTP 调用）+ `src/preview/pptxToSvg.ts` + IR 需按 SVG/DrawingML 约定重写 → ≥6 个新文件 + 1 个新服务 + 容器与中文字体部署 | Python 服务端生成，与「浏览器一键导出」架构冲突；仓库 13,173 个文件；依赖含 `skia-pathops`/`uharfbuzz` 二进制与 `PyMuPDF`(**AGPL-3.0**，商用需注意)；预览链路是「先生成 pptx 再反渲染 SVG」，其自身也踩过 SVG 序列化 bug(#325/#323) |
| **genspark-ai/genoffice** | 11958 | Apache-2.0 | **2026-11-08** | TypeScript | **与我们的「IR + 双渲染器」结构最同构**：`packages/pptx-engine`（pptx 解析成 element tree + OOXML 片段生成 + element-patch 保存，含 `embedded-fonts.ts` 14,912 B、`chart.ts` 68,850 B、`generate.ts` 78,725 B）+ `packages/pptx-render`（`render-tree.ts` 25,020 B、`text-layout.ts` 76,753 B、`build-chart.ts` 156,110 B、`metrics.ts` 11,278 B、`preset-geometry.ts` 52,737 B）+ `packages/font-metrics`。`pptxgenjs@^4.0.1` 仅作为 **devDependency**（对比测试用），生产链路已自研 | 需 fork 并抽取 4 个 `private:true` 的 workspace 包（pptx-engine / pptx-render / font-metrics / zip-gate）替换 `src/renderer/pptx/*`，并 adopt 其 `render-tree` 作为 Slide IR 骨架 → ≥6 文件 + workspace/pnpm 改造 + 持续跟随上游 | 全部是 `private:true` 内部包、**无任何公开 API 承诺**；Apache-2.0 需保留 NOTICE；单体 monorepo 6,344 文件、假设 Electron + Node ≥22.12；抽取与版本同步成本最高，本质是「买源码」而非「用库」 |
| **singerla/pptx-automizer** | 253 | MIT | **2026-10-23** | TypeScript | **模板填充路线**（与本项目「选模板」需求同构）：以真实 `.pptx` 为模板，克隆 slide/master、替换文本/图片/图表数据、保留原版式，可改已有形状与表格。npm 0.9.4 @2026-09-28 | `src/renderer/pptx/templateEngine.ts` + `src/templates/*.pptx` + `api/export/template.ts`（服务端包装）；**IR 需从「绝对坐标渲染」改为「模板槽位填充」模型** | **Node-only**（npm 无 `browser` 字段）；deps 里钉着 **`pptxgenjs: ^3.12.0`（2023 年老版）** → 为了模板能力反而引入更老的引擎；槽位模型与我们 DOM 自由布局预览的假设直接冲突（预览与导出的版式来源不同一） |

背景 / 对照候选（4 个，只为回答「为什么不走服务端、为什么不选老牌库」）。列定义与上表完全一致；「迁移到本项目要改哪几个文件」列写的是「若强行采用需付出什么」。

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件 | 坑 |
|---|---|---|---|---|---|---|---|
| tw93/Kami | 12431 | MIT | 2026-11-08 | HTML | HTML 排版规则 + 9 套文档模板 + 中文字体资产（SourceHanSerifK）；README 自述「Three rendering paths: WeasyPrint HTML to PDF by default, **python-pptx for editable PPTX on request**, and a Marp variant」 | 若走此路线 = 我们只做 HTML 模板 + python-pptx 填充，需新增 `src/templates/html/*` + Python 导出服务 | 仓库 491 个 blob 中 **0 个路径含 `pptx`**（`pptx` 能力只在 README 声明，脚本未定位）；主产物是 PDF，pptx 是附属分支 → 对本项目「可编辑 pptx 为主产物」不匹配 |
| scanny/python-pptx | 3583 | MIT | 2024-08-07 | Python | 服务端 OOXML 写库，notes/chart/table/placeholder 齐全，生态最大 | 需新增 Python 服务 + **前端彻底放弃浏览器端导出** | **已 27 个月无提交**；544 个 open issue；已知 Office 365 web 兼容 bug(#1134)、字体尺寸 dx 陷阱(#1135)、Zip Slip 安全面(#1137) |
| Ziv-Barber/officegen | 2717 | MIT | 2024-04-30 | JavaScript | 老牌 docx/xlsx/pptx 流式生成 | 不建议接入（pptx 能力远弱于 PptxGenJS，且无 chart/master 体系） | **已 30 个月无提交**；199 个 open issue 多为 2022–2024 无人回答的提问；仓库内 issue 最新一条也停在 2024-12 |
| apache/poi | 2285 | `NOASSERTION`（GitHub 未识别，未核实为 Apache-2.0） | 2026-11-07 | Java | 唯一「完整且仍在维护」的 OOXML 实现（XSLF） | 要引 JVM 服务，前端完全放弃导出 | JVM 服务在本项目栈里是纯负担；license 字段未由 API 佐证 |

---

## 2. 主干候选的真实 issue（每个 ≥2 条，含对本项目的含义）

> 以下 `#NNN` 均由 `gh issue list -R …` / `gh api repos/…/issues/NNN` 实测取得，状态与日期为 2026-11-09 当次查询值。

### 2.1 `gitbrent/PptxGenJS` —— 9 条（这是本线最关键的判断依据）

| issue | 状态 / 提出日期 / 评论 | 对本项目意味着什么 |
|---|---|---|
| [#1546](https://github.com/gitbrent/PptxGenJS/issues/1546) Combo chart writes bar-only `dLblPos="inEnd"` into the LINE chart's data labels, so PowerPoint refuses to open the file | OPEN / 2026-11-02 / **0 条评论** | 「双轴柱+线」是最常见的业务图型。用组合图就会生成**用户打不开、只提示修复**的文件 → 直接摧毁「一键导出可编辑 pptx」的卖点；且 0 回应，只能我们自己写 XML patch |
| [#1534](https://github.com/gitbrent/PptxGenJS/issues/1534) `addChart()` writes an orphan `<c:axId>` for BAR/LINE charts — triggers "repair" dialog | OPEN / 2026-09-08 / **0 条评论** | 不止组合图，**基础 bar/line** 也踩「修复」弹窗。说明 4.x 的 chart XML 生成仍不稳，我们不能把 chart 当成"白送能力" |
| [#1466](https://github.com/gitbrent/PptxGenJS/issues/1466) 扁平字符串分类总被写成 `<c:multiLvlStrRef>`，单层应写 `<c:strRef>`（部分导入器里标签退回 1,2,3…） | OPEN / 2026-07-22 / 0 条评论 | 中文分类标签在 WPS/Keynote/Numbers 里可能变成 `1,2,3` → 演示现场事故。我们的 IR 必须做「导出后回读校验」，不能只信库 |
| [#1444](https://github.com/gitbrent/PptxGenJS/issues/1444) `Content_Types.xml` 为多页 PPT 写出幽灵 slideMaster 条目 | OPEN / 2026-02-11 / 1 条（2026-09-15，非维护者） | 多页（我们的必然场景）就可能触发修复。**核对：至今未修** |
| [#1443](https://github.com/gitbrent/PptxGenJS/issues/1443) notesMaster 占位符形状被 PowerPoint 修复流程删除 | OPEN / 2026-02-11 / 1 条（2026-10-09，非维护者） | 直击我们的 `addNotes`（备注）需求：备注母版结构不合法 → 备注丢失或要求修复 |
| [#1199](https://github.com/gitbrent/PptxGenJS/issues/1199) 希望 `fit:'shrink'` 能传 `fontScale`/`lnSpcReduction` | OPEN / 2022-12-16 / **0 条评论（挂了近 4 年）** | 缩排比例不可控 = 我们无法让「DOM 预览」和「pptx 结果」对齐；精确排版只能自己做度量（见 2.4 结论） |
| [#1288](https://github.com/gitbrent/PptxGenJS/issues/1288) 如何设置东亚（East Asian）主题字体 | OPEN / 2023-09-07 / **0 条评论** | 中文字体是**官方未回答**的问题。`fontFace` 只写 `a:latin` 名字，写不进 `a:ea` 槽 → 中文可能被回退成其他字体（详见 §3 Q4） |
| [#1378](https://github.com/gitbrent/PptxGenJS/issues/1378) How to load custom fonts? | OPEN / 2025-03-24 / 2 条（最后 2025-08-14，用户自行讨论） | 嵌字体（拿到"字体不丢"的可编辑文件）在上游**没有官方路径**，只能客户端已装字体 |
| [#1307](https://github.com/gitbrent/PptxGenJS/issues/1307) `Error: blob is not supported by this platform` | OPEN / 2023-11-28 / **0 条评论** | 浏览器导出主路径 `write({outputType:'blob'})` 在部分环境直接抛错 → 我们的下载函数必须 `blob` 失败时降级 `arraybuffer` + 自己 `new Blob` |
| [#1262](https://github.com/gitbrent/PptxGenJS/issues/1262)（WPS 打开时 hyperlink 失效）/ [#1236](https://github.com/gitbrent/PptxGenJS/issues/1236)（WPS 内复制图表后 PowerPoint 报错需修复） | 均 OPEN / 2023-06-12 与 2023-03-29（另有更早的 [#1014](https://github.com/gitbrent/PptxGenJS/issues/1014) CLOSED / 2021-10-14，同一问题） | 国内客户大量使用 WPS。超链接在 WPS 里失效 = 目录页/跳转页功能当场不可用 → 我们需要「WPS 验收」这一个独立测试环节 |
| [#1170](https://github.com/gitbrent/PptxGenJS/issues/1170) 能否直接使用现成 ppt 模板？ | OPEN / 2022-10-03 / **0 条评论** | 我们的「选模板」不能指望库支持：要么自己做「从 .pptx 抽 master」（可参考 `anotb/pptx-masters`），要么走 pptx-automizer 的克隆路线 |

### 2.2 `lofcz/pptxgenjs-plus` —— issue 数 = 0，**无 issue 可引（如实说明）**

实测 `gh api repos/lofcz/pptxgenjs-plus` → `open_issues_count = 0`，仓库 created 2026-06-28。故本项**无法提供 ≥2 个 issue 链接**，改用「发版节奏 + CHANGELOG 条目」作为等价证据（这是我能拿到的最硬证据，且明确标注为自述）：

- GitHub Releases：`v4.3.7` 2026-11-07、`v4.3.6` 2026-11-02、`v4.3.5` 2026-10-31、`v4.3.4` 2026-09-24、`v4.3.3` 2026-09-19（`gh api repos/lofcz/pptxgenjs-plus/releases`）。
- CHANGELOG 自述修复项举例（原文摘录）：`Chart embedded workbooks keep per-series dataTableFormatCode styles on value cells, including zeros #1430`（即修上游 #1430）、`Text margin arrays map as documented TRBL [top,right,bottom,left]`（即修上游 #1475 的 margin 错位）、`Hide Node fs/http/https imports from browser bundlers the same way Buffer is hidden, so Vite/Rsbuild do not try to resolve node:https`（**正面命中我们的浏览器打包风险**）、`Chart titles, legends, and axis labels emit an a:ea typeface slot next to a:latin so East Asian faces render`（**正面命中中文字体坑**）、`Package-contract tests for opt-in addFont (Font parts, application/x-fontdata, Presentation font rels); default export embeds nothing`（**嵌字体有了 opt-in API**）。
- **对本项目意味着什么**：这三条恰好覆盖我们最大的三个风险（repair/损坏、浏览器打包、中文字体槽）。但它是**单人小项目（19 star）**，因此只能以「vendor 进仓库 + 单点 adapter + 可回退」的方式使用，不能当普通 npm 依赖直接吃。

### 2.3 `hugohe3/ppt-master` —— 3 条

| issue | 状态 / 日期 | 对本项目意味着什么 |
|---|---|---|
| [#325](https://github.com/hugohe3/ppt-master/issues/325)（中文）/ [#323](https://github.com/hugohe3/ppt-master/issues/323)（英文）实时预览画布空白并误报 SVG 损坏：`ElementTree` 序列化输出 `ns0:` 前缀，`innerHTML` 无法渲染 | 均 CLOSED / 2026-10-21 | 证明「单一真源 = pptx，预览由 pptx 反渲染成 SVG」这条路**自己也会踩序列化坑**。若我们将来把 DOM 预览改成「从 pptx 反渲染」，必须为 SVG 命名空间/序列化建立回归测试 |
| [#329](https://github.com/hugohe3/ppt-master/issues/329) `mirror_template_materialize.py` 在真实 PPTX 的零尺寸形状上 hard-fail | CLOSED / 2026-10-27 | 我们的「用户自带模板」一定会遇到脏数据（零尺寸框、异常 group）。模板导入层必须默认容错 + 逐项告警，不能抛异常中断导出 |
| [#331](https://github.com/hugohe3/ppt-master/issues/331) 动画导出：`with-previous` 后的 `after-previous` 只等上一行结束，未等同一拍最晚结束的效果 | CLOSED / 2026-10-28 | 动画/切换是「原生感」的关键，但时序语义极易错。**阶段 1 明确把动画排除在 IR 之外**（我们首版只做静态页），这条留作未来参考 |

### 2.4 `genspark-ai/genoffice` —— 4 条

| issue | 状态 / 日期 | 对本项目意味着什么 |
|---|---|---|
| [#2191](https://github.com/genspark-ai/genoffice/issues/2191) Slides: 支持 A4/A3 页面尺寸、纵向、自定义尺寸 | CLOSED / 2026-10-25 | 一个 11k star、有专职维护的项目也是**后期才把页面尺寸体系补齐**。我们的 IR 必须**第一天**就把 `pageSize` 做成一等公民（我们已定 13.333×7.5in / 1280×720px@96dpi，且 px↔inch 一律 /96） |
| [#2123](https://github.com/genspark-ai/genoffice/issues/2123) `savePptxToFile` 原地截断文件，保存中途崩溃会毁掉整份 pptx | CLOSED / 2026-10-21 | 导出实现必须**先在内存生成完整 Blob 再触发下载**，绝不流式覆写用户文件 |
| [#2394](https://github.com/genspark-ai/genoffice/issues/2394) slides `setText` 时 run 被拆进各自段落（当段内 run 总数相同时） | CLOSED / 2026-11-01 | IR 的 paragraph/run 两级模型必须显式定义并双向可测，否则 DOM 与 pptx 的富文本表现必然分叉 |
| [#2177](https://github.com/genspark-ai/genoffice/issues/2177) Slides: 实现 Slide Master 编辑 ribbon | CLOSED / 2026-10-24 | 母版编辑是真实需求也是复杂度黑洞 → 我们阶段 1 只支持「选模板 + 只读 master」，不允许用户编辑母版 |

### 2.5 `singerla/pptx-automizer` —— 3 条

| issue | 状态 / 日期 | 对本项目意味着什么 |
|---|---|---|
| [#215](https://github.com/singerla/pptx-automizer/issues/215) 克隆 slide 时 chart 的 `chartUserShapes` drawing 未连同其 `.rels` 一起复制 | CLOSED / 2026-10-05 | 模板克隆不是「复制 XML 文件」那么简单，必须处理 **rels 图闭包**；这条直接决定模板路线的实现成本 |
| [#186](https://github.com/singerla/pptx-automizer/issues/186) 文本里的 U+000B 会破坏 pptx | CLOSED / 2025-12-08 | 与 PptxGenJS [#1542](https://github.com/gitbrent/PptxGenJS/issues/1542)（控制字符/U+FFFE/U+FFFF 直写导致 XML 非法）**同源**：这是 OOXML 通用坑。无论在哪个库，导出前必须统一清洗控制字符 |
| [#183](https://github.com/singerla/pptx-automizer/issues/183) 0.8.0 起 `slide.getElement(...)` 对表格失效 | CLOSED / 2025-11-14 | 模板类库 API 不稳定（0.x 版本号），把它当主引擎同样是供应链风险 |

---

## 3. 五个必答问题（逐条实测回答）

### Q1：PptxGenJS 是否已停止维护？→ **是。三处交叉验证一致，触发一票否决**

| 验证点 | 实测值 | 命令 |
|---|---|---|
| `pushed_at`（仓库级） | `2025-11-28T20:17:14Z` | `scripts/gh-probe.ps1 gitbrent/PptxGenJS` |
| default branch(`master`) 最新 commit | `3c9ec1b6` @ **`2025-06-26T00:00:34Z`**（Merge PR #1401 "version-401"） | `gh api repos/gitbrent/PptxGenJS/commits?per_page=5` |
| npm 最新发布 | `4.0.1` @ **`2025-06-26T00:05:27.597Z`**（`time.modified` 2025-06-26T00:35:48Z） | `npm.cmd view pptxgenjs time --json` |
| 最新 GitHub Release | `v4.0.1` @ 2025-06-26T00:04:41Z（再往前 `v4.0.0` 2025-05-04、`v3.12.0` 2023-03-20） | `gh api repos/gitbrent/PptxGenJS/releases?per_page=3` |

**`pushed_at` 与主线不一致的原因已定位（关键取证）**：16 个分支中 `issue-1396` 的最后 commit 是 **2025-11-28T20:17:11Z，提交信息 `WIP`** —— 正是 `pushed_at` 的来源，一个从未合并的死胡同分支。另 `testing-pr-1404` 在 2025-08-09 合并过 `version-4.1.0` 分支（"Merge branch 'version-4.1.0' into testing-pr-1404"），而 **`version-4.1.0` 分支至今存在（`dd1d01c3`）却从未合入 master、也从未发布到 npm**。也就是说：**4.1.0 的开发曾经开始过，然后被抛弃。**

**停更天数**：2025-06-26 → 2026-11-09 = **501 天 ≈ 16.5 个月**，远超项目硬规则「最近 6 个月无提交 → 一票否决」。

**旁证（同一份实测数据）**：open PR **71 个**（最近的是 #1545 2026-10-29、#1541/#1540/#1539/#1538/#1537 2026-10-05 前后的高质量修复）；最近 30 个已关闭 PR 里只有 6 个真正 merged，其中**最新 merged 是 #1412 @ 2025-08-09，且落在 `testing-pr-1404` 分支而非 master**；`open_issues_count = 309`。→ **社区还在贡献修复，但已无人合并**，这是「事实上停更」而非「成熟后自然收尾」的典型形态。

**我的表态：否决 —— 但只否决"用上游原包"，不否决"这个引擎家族"。**

- **否决对象**：把 `pptxgenjs`（gitbrent 原包）作为生产直接依赖。理由是"**年轻大版本 + 无维护**"的组合风险，而不是"老库稳定"：4.x 线仅有 `4.0.0`(2025-05-04) 与 `4.0.1`(2025-06-26) 两个正式版，是一次**2025 年 5 月才落地的大重写**（4.0.0 相较 3.12.0 相隔 14 个月，是大版本重构），重写后仅活了一个月就停；而 2026 年 2 月~11 月陆续还在暴露 **「PowerPoint 要求修复」级别**的 XML 生成 bug（#1546/#1534/#1466/#1444/#1443），这些恰恰是**只有维护者能修**的那一类。老库可以用「稳定」豁免，「刚重写完就没人管」不能。
- **豁免/替代**：引擎能力本身继续用，但供应链换成**活跃分支持久化 vendor**：`lofcz/pptxgenjs-plus@4.3.7`（MIT，2026-11-07 发版，CHANGELOG 明确在合并上游社区修复，并补了 `a:ea` 中文字体槽与 opt-in `addFont`）。
- **风险缓释（三级）**：
  1. **锁版本 + vendor**：把 tarball 提交进仓库（`vendor/pptxgenjs-plus-4.3.x.tgz`），`package.json` 用 `file:` 引用，杜绝 registry 漂移与「包被删」风险。
  2. **单点隔离**：全项目**只有 1 个文件** `src/renderer/pptx/adapter.ts` 允许 `import` 该库；其余代码只认我们自己的 `appendText/appendChart/appendNotes/save` 窄接口 → 换实现 = 改 1 个文件。
  3. **两级回退**：G1 → 回退 `gitbrent/PptxGenJS@4.0.1`（API 同源，改 import + 关掉 4.3 新字段）；G2 → 整条 4.x 不可用时，切自研 OOXML 层（直接参考 `genoffice/pptx-engine`(Apache-2.0) 或 `ppt-master/pptx_ooxml`(MIT)），IR 不动。
  4. **补丁能力**：约定 `patches/`（pnpm patch）作为第四级，用于必须自己修的 XML 缺陷（例如 #1546 的 `dLblPos`）。

### Q2：浏览器端能否直接生成？bundle 多大？是否依赖 Node API？

- **能直接生成**。`write(props?: WriteProps): Promise<string | ArrayBuffer | Blob | Uint8Array>`（types L99）；`WriteProps.outputType` 默认 `'blob'`（L2443-2449）；`OutputType` 枚举实测 6 值：`arraybuffer / base64 / binarystring / blob / nodebuffer / uint8array`（L172-181）。浏览器下载用 `writeFile({fileName})`（L107）。README 原文：「**Instantly download `.pptx` files from the browser with proper MIME handling**」「Export as **base64**, **Blob**, **Buffer**, or **Node stream**」。
- **bundle 体积（v4.0.1 tag 的 `dist/` 真实字节数，raw 未压缩）**：
  | 文件 | 字节 | KB |
  |---|---|---|
  | `dist/pptxgen.min.js`（浏览器 min） | 271,010 | **264.7** |
  | `dist/pptxgen.bundle.js`（README 推荐的 CDN 版） | 460,889 | **450.1** |
  | `dist/pptxgen.es.js`（ESM，给 Vite 打） | 516,931 | 504.8 |
  | `dist/pptxgen.cjs.js` | 516,944 | 504.8 |
  | `types/index.d.ts` | 73,191 | 71.5 |

  另：npm `dist.unpackedSize = 2,605,307` B / `fileCount = 10`（含 4 个 `.map`，故整包 2.6MB，**真正进浏览器的应看上面的 dist 数字**）。gzip/brotli 后体积**未核实**（见「未核实项」）。
- **是否依赖 Node API**：运行期 deps = `@types/node ^22.8.1`、`https ^1.0.0`、`image-size ^1.2.1`、`jszip ^3.10.1`。`package.json` 的 **`browser` 字段把 Node 模块全部置 `false`**：`{"express":false,"fs":false,"https":false,"image-size":false,"node:fs":false,"node:https":false,"os":false,"path":false}`。
  → 解读：库内**确实存在 Node 分支代码**（`fs`/`https`/`os`/`path`/`express`），浏览器可用是靠 bundler 别名把这些置空；**`image-size` 在浏览器被禁用**，意味着浏览器端图片尺寸探测走不到 Node 的 image-size 路径（需要我们自己传 `w/h`）。而 4.3.x 的 CHANGELOG 明确把「Vite/Rsbuild 试图解析 `node:https`」列为已修复项 → 反证这是**真实存在的浏览器打包痛点**，正是我们要在 adapter 层重点验证的。
- **对我们的硬约束**：`@types/node` 出现在 runtime deps 里，TS 项目下要确保它不进客户端类型面；`jszip` 是我们能接受的（浏览器原生可用）。

### Q3：IR→pptx 能力边界（逐项实测，证据来自 `types/index.d.ts` 行号）

| 能力 | 结论 | 实测证据 |
|---|---|---|
| 自定义 16:9 尺寸 | ✅ 支持，且有现成 | `LAYOUT_WIDE (13.33" x 7.5")`（L39）；`defineLayout({name,width,height})`（L130-132）。我们的 13.333×7.5 用 `defineLayout` 精确给值即可 |
| 绝对坐标文本框 | ✅ | `PositionProps`（`x/y/w/h`）+ `addText`；`presLayout`（L22/L2577）暴露版心尺寸供换算 |
| `addNotes`（备注） | ✅ 但**只接字符串** | `addNotes(notes: string): Slide`（L2650）。注意 #941 曾把对象数组写成 `[object Object]`；且备注母版结构有 bug（#1443 OPEN） |
| 原生 chart（bar/line/pie） | ✅ 且超出需求 | `CHART_NAME` 枚举含 `area/bar/bar3D/bubble/bubble3D/doughnut/line/pie/radar/scatter`（L161-170）；`addChart(type, data, options)`（L2631） |
| master/layout 定义 | ✅ | `defineSlideMaster(props: SlideMasterProps)`（L137）；`PLACEHOLDER_TYPE = 'title' \| 'body' \| 'pic' \| 'chart' \| 'tbl' \| 'media'`（L629）；`masterName` 出现在 3 处 |
| 图片 PNG/JPEG/SVG | ✅（SVG 当**图片**喂，不是一等公民） | base64 示例 `image/png;base64,...`（L893/L2544）；`types` 中 `svg` 关键字 **0 次命中** → 无 SVG 生成能力，只能 `data:` 塞入。已知坑：#1150（SVG 进 master 触发修复，CLOSED/2022-08-22）、#1410（SVG 渐变导出异常，OPEN/2025-08-07）、#963（Node 下 SVG 不工作，CLOSED/2021-06-15） |
| 字体名写入 `fontFace` | ✅ 但只写名字 | `fontFace?: string`（L1188）；`headFontFace`/`bodyFontFace`（L1296/1302）。**不嵌字体**（见 Q4） |
| `fit:'shrink'` / `autoFit` | ⚠️ 有，但**参数不可控** | `shrink` 4 处引用 + `autoFit` 1 处；#1199 请求暴露 `fontScale`/`lnSpcReduction` 挂了近 4 年 0 回应 |
| 表格 | ✅ 但有坑 | `addTable`（3 处）、`tableToSlides`；坑：#1095（table cell 的 `transparency` 无效，已 CLOSED）、#983/#1069/#1451（自动分页表格溢出到右/下边界） |
| 透明度 | ✅ 三处独立 | `transparency?: number` 分别出现在 fill（L1017）、text（L1238）、picture（L1397） |
| 圆角 | ✅ | `rectRadius?: number`（L1509） |
| （附带）浏览器环境检测 | ❌ 无 | `isBrowser` 关键字 **0 次命中** → 需自己判环境决定 `blob` 还是 `nodebuffer` |

**IR 设计含义**：Q3 表里全部为 ✅，意味着**现有 Slide IR 的能力集可以被 PptxGenJS 完整承载**，不需要为它裁剪 IR。唯一需要在 IR 层做决策的是 `fit:'shrink'`（建议**不进 IR**，理由见 Q4 与「本线结论」）。

### Q4：中文字体坑（务必带真实 issue）

**坑的机理（已由实测证据确认）：** `fontFace` 只是把字体**名字**写进 DrawingML 的 run/paragraph 属性，**字体本体不随文件走**。所以：
1. 打开文件的机器若没装该字体 → PowerPoint/WPS 自行替换 → 版式走样。中文尤其严重：微软雅黑 / 宋体 / 思源黑体 / Noto Sans CJK / 苹方，在 Windows / macOS / WPS / 在线 Office 上**字体名与可用性都不一样**。
2. 上游对「东亚字体槽」长期无官方支持：`a:ea` 槽要靠库显式写。实测上游把中文问题**晾着**：#1288（East Asia 主题字体，OPEN，0 评论，2023-09-07 提出）、#1378（自定义字体加载，OPEN）、#916（East Asian Font Face，CLOSED，仅到"能设名字"层面）、#1420（**图表标题/图例的中文字体设置无效**，OPEN，2025-09-17）。
3. `fit:'shrink'` 是 **PowerPoint 的 autofit 属性**，真正的缩放发生在**客户端排版时**，库只写标记。所以我们「DOM 预览算出的换行/高度」和「PowerPoint 渲染出的」必然有差异，且**不可控**（#1199 请求暴露 `fontScale`/`lnSpcReduction`，4 年无人应）。这正是双渲染器架构最大的固有风险点。

**「`fit:'shrink'` 在 PowerPoint vs WPS 行为差异」的直接 issue：`未核实`（找不到）。** 原因：本会话 `gh search issues 'repo:gitbrent/PptxGenJS …'` 一律返回 `Invalid search query "( repo:\"gitbrent/PptxGenJS shrink\" ) type:issue". The listed users and repositories cannot be searched…`（对 `shrink/autofit/WPS/中文字体/font embed` 共 15 次尝试全失败），只能用 `gh issue list --state all --limit 400` 取回 400 条后本地关键词扫描（188 open / 212 closed）。扫描结果：**没有**同时命中 WPS 与 shrink/autofit 的 issue；WPS 相关的只有超链接与图表（#1262 / #1236 / #1014）。→ 因此我**不编造**该差异的具体表现，只把它作为「必须实测」的风险项写进结论。

**给项目的处置建议（三条，且都有先例支撑）：**
1. **字体白名单**：IR 里只允许「跨平台必装 + 可嵌」的字体族，并内置 3 档映射表（Win=微软雅黑 / mac=苹方 / 兜底=思源黑体 Source Han Sans）；`docProps` 与 run 属性都写映射后的名字。参考 `tw93/Kami` 自带 `SourceHanSerifK` 字体资产 + `font_compat.py`、`genoffice` 的 `packages/font-metrics` + `embedded-fonts.ts`(14,912 B) + `tools/check-font-metrics-provenance.mjs`。
2. **嵌字体**：上游做不到，改用 `pptxgenjs-plus` 的 opt-in `addFont`（CHANGELOG：「Package-contract tests for opt-in `addFont`(Font parts, `application/x-fontdata`, Presentation font rels); **default export embeds nothing**」）。注意：嵌字体有体积与许可证双重代价（思源系列 OFL 可嵌，微软雅黑**不可**再分发）→ 只嵌 OFL 字体。
3. **不把 `fit:'shrink'` 当布局依赖**：IR 明确「文字必须按我方 font-metrics 预排版到框内」，导出时只写固定字号 + `wrap`，把 `shrink` 仅作为兜底。可复用 `pptxgenjs-plus` 的 `measureText/fitText/checkOverflow/registerFontMetrics`（`pptxgenjs-plus-std` 包，CHANGELOG 自述）或 `genoffice` 的 `text-layout.ts`。

### Q5：每个主干 ≥2 真实 issue —— 见 §2（已逐条给出，含状态/日期/对本项目含义）。

---

## 本线结论

### 用谁

1. **主渲染器 = `pptxgenjs-plus`（MIT，`lofcz/pptxgenjs-plus`）**，vendor 进仓库、精确锁版本、**只在 `src/renderer/pptx/adapter.ts` 一个文件里 import**。
   - 理由：它是本会话实测到的**唯一同时满足**「浏览器端直接产出原生可编辑 pptx + 成熟 API 面（73KB 类型定义，chart/notes/master/表格/透明度/圆角全覆盖）+ MIT + 仍在发版（2026-11-07）」的实现；且 CHANGELOG 明确在合并上游社区修复，并补上了 `a:ea` 中文字体槽、opt-in 嵌字体、`node:https` 浏览器打包修复、`measureText/fitText` —— **正好覆盖我们三个最大风险**。
   - 约束：`engines: node>=24` 需架构确认；19 star / 单人维护 → 必须 vendor，不许走 registry 漂移。
2. **供应链回退 = `gitbrent/PptxGenJS@4.0.1`**（同 API）。仅作 G1 预案，不作默认。
3. **必须读、但要按"参考实现"对待的两个仓库**（都是 MIT/Apache-2.0、都可商用）：
   - `hugohe3/ppt-master`：`pptx_ooxml/` + `pptx_shapes/`(presetShapeDefinitions) + `pptx_animations` + `pptx_template_import`(模板克隆) + `pptx_to_svg`(反渲染预览)。**这是我们将来「自研 OOXML 层」最省力的路线图**，也是「预览与导出同源」的另一种架构答案。
   - `genspark-ai/genoffice`：`pptx-engine`(element tree + patch)、`pptx-render`(render-tree/text-layout/metrics/build-chart)、`font-metrics`、`embedded-fonts`。**与我们「IR + 双渲染器」同构**，工程细节（字体度量、preset-geometry、chart 嵌入工作簿）可直接借鉴；它甚至把 `pptxgenjs` 只留作 devDependency 做对比测试 —— 这是「严肃项目最终自研 OOXML」的最强旁证。

### 不用谁

- **`gitbrent/PptxGenJS` 原包**：踩 6 个月铁律（501 天无主线提交、71 个 PR 未合、309 open item、2026 年仍在产出「打不开的 pptx」级别 bug 且零回应）→ **否决成立**。
- **`scanny/python-pptx`（27 个月停更、544 open issue）**、**`Ziv-Barber/officegen`（30 个月停更）**、**`apache/poi`（JVM）**、**`tw93/Kami` 的 python-pptx 路线**：共同问题不是质量，而是**都必须服务端生成**，与「浏览器一键导出可编辑 pptx」的既定架构正面冲突，且会把部署面从「静态前端」扩大到「Python/JVM 服务 + 字体环境 + 容器」。这正是我们**不在服务端生成**的直接理由。
- **`singerla/pptx-automizer` 作为主引擎**：模板克隆确实贴合「选模板」，但它 ①Node-only ②deps 钉着 `pptxgenjs ^3.12.0`（2023 老版，等于为了模板引入更旧的引擎）③「槽位填充」模型会让我们**失去 DOM 预览与导出同源**的前提。→ 保留为「高级模板（用户自带 .pptx）」的**候选实现**，阶段 2 再评估。

### 为什么（一句话压缩）

「浏览器端出原生可编辑 pptx」这个约束把候选池砍到只剩 PptxGenJS 家族；而 PptxGenJS 家族的**上游已死、分支还活着**。所以本线的判断不是「换库」，而是**「换供应链 + 保住单点可替换性」**：用活跃分支拿到 2026 年的修复，用 adapter 把库关进 1 个文件，用 vendor 消除依赖漂移，用 IR 保证「换实现不改业务」。同时，`genoffice` 的存在证明这条路有天花板——**当 PPT 保真度要求继续上升时，自研 OOXML 层是必然终点，而双渲染器架构恰好让这次迁移只影响一个渲染器**。

### 若踩否决项的处置（可直接当验收清单用）

| 级别 | 触发条件 | 动作 | 成本 |
|---|---|---|---|
| **G0 默认** | — | `pptxgenjs-plus@4.3.x` vendor 化 + `adapter.ts` 单点隔离 + `patches/` 兜底 | 0 |
| **G1 降级** | plus 停更 >6 个月 / 关键 bug 不回 / 不兼容我们的 Node 版本 | 切 `gitbrent/PptxGenJS@4.0.1`（同 API）：改 `adapter.ts` import + 关闭 4.3 新字段 + 把必须的修复落成 `patches/pptxgenjs+4.0.1.patch` | **1 个文件 + 1 个 patch** |
| **G2 换实现** | 4.x 线整体不可用（大面积 repair 无法绕过） | 用 `genoffice/pptx-engine`+`pptx-render`（Apache-2.0）或 `ppt-master/pptx_ooxml`（MIT）自建渲染器，**IR 不变** | 中（渲染器重写，业务零改） |
| **横切（必须现在就做，否则上面三级都失效）** | — | ①**导出前文本清洗**（控制字符、U+FFFE/U+FFFF、U+000B；上游 #1542 / automizer #186 同源坑）；②**CI 用 LibreOffice 打开校验**（"repair 检测"，genoffice 已有 LibreOffice consumer CI 先例）；③IR 不许泄漏任何库专有字段 | 小，收益最大 |

### 需要 Lead/架构拍板的 3 件事

1. **是否允许把第三方 tarball vendor 进仓库**（G0 的前提；否则只能被动跟 registry，风险不可控）。
2. **运行时 Node 版本**：`pptxgenjs-plus` 要求 `node>=24`；若我们锁 Node 22 LTS，则只能先用 `PptxGenJS@4.0.1`（G1）并把 plus 的修复选择性打 patch。
3. **是否接受「DOM 预览与 pptx 必有 ±px 级差异」**：若接受，`fit:'shrink'` 不进 IR；若不接受，必须在阶段 1 就把 font-metrics 预排版做进 IR（工作量 +1 人周级别）。

---

## 未核实项

1. **`pptxgenjs-plus` 的 CHANGELOG 自述修复未独立验证**：repair/损坏修复、`a:ea` 东亚字体槽、`addFont` 嵌字体、`measureText/fitText` 均为**其 CHANGELOG 原文**，本会话未实际生成 pptx 验证（阶段 0 禁止写产品代码，无运行环境）。
2. **`pptxgenjs-plus` 的 API 兼容性无法用类型核对**：仓库 `git/trees/HEAD?recursive=1` 中不存在 `types/index.d.ts`（只有 `src/vendor/fonteditor-core/convert-to-eot.d.ts`），类型由 `bun run build:types` 生成 → 仅能依据 CHANGELOG 的「preserving the public API」自述。
3. **npm 最新版本号有 1 个补丁差**：`npm view pptxgenjs-plus version = 4.3.6`（`time.modified = 2026-11-02`），而 GitHub Releases 已有 `v4.3.7`（2026-11-07）。可能为镜像延迟（本环境 npm 走 `registry.npmmirror.com`），**官方 registry 未直连核实**。
4. **「`fit:'shrink'` 在 PowerPoint vs WPS 的行为差异」无可引 issue**：`gh search issues 'repo:…'` 在本环境报 `Invalid search query … cannot be searched`（15 次尝试全失败），改由 400 条 `gh issue list` 本地关键词扫描，未发现该组合的直接记录。**故不描述具体差异表现。**
5. **`genoffice` 的 `pptx-engine`/`pptx-render` 抽取可行性未实测**：未验证其 `text-layout.ts`/`embedded-fonts.ts` 是否依赖 Node `fs`（`package.json` 显示 `jszip`/`fast-xml-parser` 可浏览器化，但 `devDependencies` 含 `@types/node`）。
6. **`ppt-master` 的预览链路未跑通**：需要 Python + `skia-pathops`/`uharfbuzz` 二进制，本会话仅静态阅读树结构、README、`requirements.txt`。
7. **`Kami` 的 pptx 生成代码未定位**：491 个 blob 中**0 个路径含 `pptx`**，pptx 能力仅由 README 声明（「python-pptx for editable PPTX on request」）；其 `deliver.py` 实测只涉及 PDF/WeasyPrint（`from render import render_pdf`、注释「WeasyPrint and math failures both block delivery」）。→ **pptx 实现细节未核实**。
8. **`apache/poi` 的 license**：GitHub API 返回 `NOASSERTION`（未识别），Apache-2.0 属常识但**未由本次实测字段佐证**。
9. **bundle 的 gzip/brotli 体积未实测**：表中均为 raw 字节（未压缩）。
10. **未实测真实中文长文本的导出结果**（字体回退、换行、`shrink` 表现）：需运行环境与 Office/WPS 实机，超出阶段 0 边界。
11. **未核实 `pptxgenjs-plus` 是否已把 291 条上游 open issue 中的关键修复全部合入**（如 #1546 的 `dLblPos`、#1534 的 `axId`）——CHANGELOG 仅提到合并了 #1430、margin TRBL 等，**#1546/#1534 未见明确条目**，这是 G0 方案最需要尽快验证的一项。

---

## 原始命令与输出

> 说明：本环境 `win_bash` 不可用，全部命令经 `pwsh` 工具执行；直接跑 `.ps1` 会被执行策略拦，故统一用
> `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <脚本>`。npm 首次执行因沙箱拒绝写 `AppData\Local\npm-cache` 报 `EPERM`，改为 `npm.cmd --cache .research\.npmcache view …` 后成功。

### 0) 仓库探针 `scripts/gh-probe.ps1`（本会话实测）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 gitbrent/PptxGenJS scanny/python-pptx Ziv-Barber/officegen apache/poi
```
```text
gitbrent/PptxGenJS	6361	MIT	2025-11-28T20:17:14Z	TypeScript	False	309	2016-02-23T02:15:29Z	Build PowerPoint presentations with JavaScript. Works with Node, React, web browsers, and more.
scanny/python-pptx	3583	MIT	2024-08-07T17:36:44Z	Python	False	544	2012-11-21T11:03:31Z	Create Open XML PowerPoint documents in Python
Ziv-Barber/officegen	2717	MIT	2024-04-30T10:40:22Z	JavaScript	False	199	2013-06-16T07:58:57Z	Standalone Office Open XML files ... in javascript. The output is a stream.
apache/poi	2285	NOASSERTION	2026-11-07T12:08:07Z	Java	False	44	2009-05-21T01:15:15Z	Mirror of Apache POI gitbox. The Java API for Microsoft Documents.
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 hugohe3/ppt-master tw93/Kami genspark-ai/genoffice
```
```text
hugohe3/ppt-master	74872	MIT	2026-11-08T10:38:28Z	Python	False	1	2025-12-10T06:54:33Z	AI turns documents or topics into real, native PowerPoint decks—with native shapes, transitions and animations, ... and support for your own .pptx templates.
tw93/Kami	12431	MIT	2026-11-08T04:51:41Z	HTML	False	0	2026-04-20T16:35:19Z	👩‍🚒 Good content deserves good paper. Layout rules and templates that let AI agents export PDF, PNG and editable PowerPoint.
genspark-ai/genoffice	11958	Apache-2.0	2026-11-08T02:35:37Z	TypeScript	False	71	2026-07-31T09:40:58Z	Free, open-source AI Office suite: ... create and edit real .docx/.xlsx/.pptx files locally. Bring your own key.
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 lofcz/pptxgenjs-plus shbernal/ts-pptx singerla/pptx-automizer anotb/pptx-masters henryhyw/slidepoise
```
```text
lofcz/pptxgenjs-plus	19	MIT	2026-11-07T17:12:57Z	TypeScript	False	0	2026-06-28T13:30:00Z	Build PowerPoint presentations with JavaScript. Works with Node, Browser, and more.
shbernal/pptx-ts	5	MIT	2026-10-31T02:26:35Z	TypeScript	False	18	2026-07-24T10:16:27Z	Create PowerPoint presentations from TypeScript
singerla/pptx-automizer	253	MIT	2026-10-23T07:26:45Z	TypeScript	False	2	2021-03-03T08:34:45Z	A template based pptx generator for Node.js
anotb/pptx-masters	6	MIT	2026-02-25T21:29:01Z	JavaScript	False	1	2026-02-25T03:09:19Z	Extract PptxGenJS slide masters from corporate PowerPoint templates
henryhyw/slidepoise	98	MIT	2026-10-23T16:04:08Z	Python	False	0	2026-09-05T15:59:09Z	Open-source agentic slide generation with free-form visual design and editable PowerPoint output.
```

### 1) PptxGenJS 停更三处交叉验证（`.research\a-cross.ps1`）

```text
=== 1. PptxGenJS repo meta ===
default_branch = master
forks_count    = 973
subscribers    = 76
size_kb        = 121380
homepage       = https://gitbrent.github.io/PptxGenJS/
has_discussions= True
=== 2. latest commits on default branch ===
3c9ec1b6	2025-06-26T00:00:34Z	Merge pull request #1401 from gitbrent/version-401
e3687952	2025-06-25T23:56:35Z	updated for v4.0.1
9d32a377	2025-06-25T23:15:52Z	updated
590a43c2	2025-06-25T22:28:28Z	new build
e429c145	2025-06-25T22:28:21Z	updated for v4.0.1
=== 3. latest release / tag ===
v4.0.1	2025-06-26T00:04:41Z	Version 4.0.1
v4.0.0	2025-05-04T16:30:20Z	Version 4.0.0
v3.12.0	2023-03-20T03:46:35Z	Version 3.12.0
```
（同脚本的 npm 段首次失败，原文如下——沙箱拒绝写 npm 默认缓存目录：）
```text
=== 4. npm view pptxgenjs ===
version        =
dependencies   = { "error": { "code": "EPERM", "summary": "FetchError: Invalid response body while trying to fetch https://registry.npmmirror.com/pptxgenjs: EPERM: operation not permitted, open 'C:\\Users\\Administrator\\AppData\\Local\\npm-cache\\_cacache\\tmp\\***'" ...
```

### 2) npm 真实发布数据（`.research\a-npm.ps1`，cache 改到 workspace）

```text
=== npm view pptxgenjs (cache redirected into workspace) ===
version      = 4.0.1
license      = MIT
main         = dist/pptxgen.cjs.js
module       = dist/pptxgen.es.js
types        = types
unpackedSize = 2605307
fileCount    = 10
deps         = {   "@types/node": "^22.8.1",   "https": "^1.0.0",   "image-size": "^1.2.1",   "jszip": "^3.10.1" }
engines      =
modified     = 2025-06-26T00:35:48.625Z
=== npm publish dates, newest 12 ===
4.0.1	2025-06-26T00:05:27.597Z
4.0.1-beta.2	2025-05-30T14:07:02.050Z
4.0.1-beta.1	2025-05-30T01:49:42.030Z
4.0.1-beta.0	2025-05-29T03:41:02.738Z
4.0.0	2025-05-04T16:31:13.447Z
4.0.0-beta.1	2025-04-29T04:19:15.331Z
4.0.0-beta.0	2025-04-27T01:46:35.091Z
3.13.0-beta.1	2025-04-24T04:24:16.065Z
3.13.0-beta.0	2023-05-17T03:19:19.965Z
3.12.0	2023-03-20T03:47:08.099Z
3.12.0-beta.0	2023-02-23T04:52:07.918Z
3.11.0	2022-08-06T20:13:02.647Z
=== branches, newest 12 by commit date ===
eslint	9768351f
gh-pages	f7b4b9b6
gh-pages-doc-v2.0.0	a36a39f2
issue-1396	c5f9eac8
npm-updates	a1d97ee0
pr-1126	7f1090a5
... (pr-1133 / pr-1140 / pr-1147 / pr-1176 / pr-1201 / testing-pr-1404)
=== tags, newest 8 ===
v4.0.1	3c9ec1b6
v4.0.0	8692262f
v3.12.0	5a30b0f5
```

### 3) `pushed_at` 与主线不一致的取证（`.research\a-successors.ps1` 末段）

```text
=== commits on selected branches (to explain pushed_at 2025-11-28) ===
master	2025-06-26T00:00:34Z	Merge pull request #1401 from gitbrent/version-401
testing-pr-1404	2025-08-09T15:01:28Z	Merge branch 'version-4.1.0' into testing-pr-1404
issue-1396	2025-11-28T20:17:11Z	WIP
npm-updates	2022-02-26T18:11:15Z	npm updates
eslint	2022-08-28T22:00:16Z	minor
gh-pages	2025-06-29T21:06:16Z	updated for 4.0.1
```
```text
=== PptxGenJS: all branches ===
branch_count = 16
eslint, gh-pages, gh-pages-doc-v2.0.0, issue-1396, master, npm-updates, pr-1126, pr-1133,
pr-1140, pr-1147, pr-1176, pr-1201, testing-pr-1404, version-3.13.0, version-4.0.0, version-4.1.0
=== PptxGenJS: does branch version-4.1.0 exist? ===
exists: version-4.1.0 @dd1d01c3
```

### 4) PR / 合并活跃度（`.research\a-types.ps1` 前段）

```text
=== PR / merge activity ===
open_prs = 71
OPEN  #1545	2026-10-29	feat: add bullet.color to set bullet character colour independently of text
OPEN  #1541	2026-10-06	fix: preserve caller options when auto-paging tables
OPEN  #1540	2026-10-06	Fix dangling axis references in 2D charts
OPEN  #1539	2026-10-06	fix(types): support NodeNext consumers
OPEN  #1538	2026-10-06	fix: avoid mutating shared shadow options during serialization
OPEN  #1537	2026-10-05	Fix embedded workbook table ref for category and bubble charts (fixes #1531)
OPEN  #1533	2026-09-06	fix: unique p:cNvPr/@id for table+shape slides
OPEN  #1529	2026-08-23	build: remove unused image-size dependency
OPEN  #1526	2026-08-18	fix: emit `pic` and `tbl` placeholder types
OPEN  #1475	2026-08-10	Fix text margin arrays to use documented TRBL order
OPEN  #1473	2026-08-09	chore: remove unused image-size dependency
OPEN  #1470	2026-08-03	Document gradient fills
--- recently merged PRs ---
merged_in_last_30_closed = 6
MERGED #1412	merged_at=2025-08-09T16:01:35Z	encode xml entities in company name in generated app.xml
MERGED #1411	merged_at=2025-08-09T15:01:42Z	Testing Pull #1404
MERGED #1401	merged_at=2025-06-26T00:00:34Z	Version 4.0.1
MERGED #1386	merged_at=2025-05-04T16:27:05Z	Version 4.0.0
```

### 5) 关键 issue 的日期与"谁在回应"（`.research\a-issuedetail.ps1`）

```text
1199	open	created=2022-12-16T07:48:52Z	comments=0	last=no comments	[FEATURE] allow user to provide fontScale and lnSpcReduction values with fit: 'shrink'
1288	open	created=2023-09-07T10:31:24Z	comments=0	last=no comments	[Question]How to set the east asia theme font
1420	open	created=2025-09-17T02:22:48Z	comments=2	last=subangbang19950406 @ 2025-09-24T07:01:32Z	The Chinese font settings for the titles and legends of chart categories are not effective
1307	open	created=2023-11-28T00:54:13Z	comments=0	last=no comments	Error: blob is not supported by this platform
1296	open	created=2023-10-19T09:28:34Z	comments=0	last=no comments	Is it possible to set different layout width for slides
1170	open	created=2022-10-03T10:34:22Z	comments=0	last=no comments	Is there a plan to use the existing ppt templates? ...
1443	open	created=2026-02-11T02:43:30Z	comments=1	last=IHAGI-c @ 2026-10-09T10:50:58Z	[BUG] notesMaster placeholder shapes are removed by PowerPoint repair
1546	open	created=2026-11-02T17:36:28Z	comments=0	last=no comments	[BUG] Combo chart writes bar-only dLblPos="inEnd" ... PowerPoint refuses to open the file
1534	open	created=2026-09-08T14:14:01Z	comments=0	last=no comments	[BUG] addChart() writes an orphan <c:axId> for BAR/LINE charts ... triggers "repair" dialog
1466	open	created=2026-07-22T12:25:53Z	comments=0	last=no comments	Charts: flat string categories are always written as <c:multiLvlStrRef> ...
1444	open	created=2026-02-11T02:43:45Z	comments=1	last=nskondratev @ 2026-09-15T11:20:58Z	[BUG] Content_Types.xml references phantom slideMaster entries ...
1416	open	created=2025-08-25T16:12:30Z	comments=0	last=no comments	[BUG] Slide master images overwrite
1236	open	created=2023-03-29T08:16:08Z	comments=0	last=no comments	[BUG] Copying and pasting a line chart within WPS ...
1378	open	created=2025-03-24T03:20:56Z	comments=2	last=liyao1520 @ 2025-08-14T07:50:23Z	How to load custom fonts?
1451	open	created=2026-04-06T08:48:52Z	comments=0	last=no comments	Auto-fit table columns to slide width without overflow
1137	open	created=2022-07-29T16:02:36Z	comments=1	last=xingkoo @ 2022-07-29T16:11:32Z	SlideMasterProps.margin and placeholder.options.margin unit is diff.
```

### 6) issue 总量与关键词扫描（`gh issue list --limit 400` 落盘后本地过滤）

```powershell
gh issue list -R gitbrent/PptxGenJS --limit 400 --state all --json number,title,state,comments,createdAt > .research\a-issues.json
```
```text
total_issues = 400
open = 188  closed = 212
--- keyword hits（节选） ---
1199	OPEN	[FEATURE] allow user to provide fontScale and lnSpcReduction values with fit: 'shrink'
1288	OPEN	[Question]How to set the east asia theme font
1420	OPEN	The Chinese font settings for the titles and legends of chart categories are not effective
1443	OPEN	[BUG] notesMaster placeholder shapes are removed by PowerPoint repair
1444	OPEN	[BUG] Content_Types.xml references phantom slideMaster entries for multi-slide presentations
1546	OPEN	[BUG] Combo chart writes bar-only dLblPos="inEnd" ... PowerPoint refuses to open the file
1534	OPEN	[BUG] addChart() writes an orphan <c:axId> for BAR/LINE charts ...
1451	OPEN	Auto-fit table columns to slide width without overflow
1262	OPEN	[BUG] Prop [hyperlink] doesn't work when open with WPS
1236	OPEN	[BUG] Copying and pasting a line chart within WPS ...
1014	CLOSED	hyperlink not work when opened at wps
916	CLOSED	Feature Request - East Asian Font Face
1095	CLOSED	transparency doesn't work in table cell
983	CLOSED	[BUG]Table layout broken with auto pagination and merged cells
```

### 7) `gh search issues` 在本环境不可用（因此 Q4 的直接佐证为「未核实」）

```powershell
gh search issues 'repo:gitbrent/PptxGenJS chart' --limit 5 --json number,title
```
```text
exit=1  Invalid search query "( repo:\"gitbrent/PptxGenJS chart\" ) type:issue".
The listed users and repositories cannot be searched either because the resources do not exist
or you do not have permission to view them.
```
```powershell
gh search issues 'PptxGenJS shrink' --limit 5 --json number,title   # 去掉 repo: 后可用
```
```text
exit=0  [{"number":31,"title":"fix: background slide text overflow at top and bottom (slide 3)"}]
```

### 8) 能力边界：`types/index.d.ts` 真实行（`.research\a-final.ps1` / `a-typelineno.ps1`）

```text
=== A. write / outputType / blob ===
L26: readonly OutputType: typeof PptxGenJS.OutputType
L99: write(props?: PptxGenJS.WriteProps): Promise<string | ArrayBuffer | Blob | Uint8Array>
L107: writeFile(props?: PptxGenJS.WriteFileProps): Promise<string>
L172: export enum OutputType {
L2443: export interface WriteProps extends WriteBaseProps {
L2449: outputType?: WRITE_OUTPUT_TYPE
=== 2. OutputType 枚举真值 (L168-190) ===
	export enum OutputType {
		'arraybuffer' = 'arraybuffer',
		'base64' = 'base64',
		'binarystring' = 'binarystring',
		'blob' = 'blob',
		'nodebuffer' = 'nodebuffer',
		'uint8array' = 'uint8array',
	}
=== 3. WriteProps 定义 (L2443-2460) ===
	export interface WriteProps extends WriteBaseProps {
		/** Output type
		 * - values: 'arraybuffer' | 'base64' | 'binarystring' | 'blob' | 'nodebuffer' | 'uint8array' | 'STREAM'
		 * @default 'blob' */
		outputType?: WRITE_OUTPUT_TYPE
	}
=== B. addNotes ===
L2650: addNotes(notes: string): Slide
=== C. defineSlideMaster / placeholder ===
L137: defineSlideMaster(props: PptxGenJS.SlideMasterProps): void
L629: export type PLACEHOLDER_TYPE = 'title' | 'body' | 'pic' | 'chart' | 'tbl' | 'media'
=== D. layout ===
L39: - 'LAYOUT_WIDE'  (13.33" x 7.5")
L130: @example pptx.defineLayout({ name:'A3', width:16.5, height:11.7 });
L132: defineLayout(layout: PptxGenJS.PresLayout): void
L2472: export interface PresLayout
=== E. fit / fontFace / transparency / rectRadius ===
L1017: transparency?: number          (fill)
L1188: fontFace?: string
L1238: transparency?: number          (text)
L1397: transparency?: number          (picture)
L1509: rectRadius?: number
=== F. charts ===
L161: 'area' = 'area',
L163: 'bar3d' = 'bar3D',
L164: 'bubble' = 'bubble',
L166: 'doughnut' = 'doughnut',
L167: 'line' = 'line',
L168: 'pie' = 'pie',
L169: 'radar' = 'radar',
L170: 'scatter' = 'scatter',
L2631: addChart(type: CHART_NAME | IChartMulti[], data: any[], options?: IChartOpts): Slide
=== G. 关键字计数（types/index.d.ts，73,191 B）===
addNotes 2 / addChart 2 / defineSlideMaster 1 / addImage 3 / addTable 3 / addShape 3 / addText 3
writeFile 3 / outputType 1 / fontFace 1 / shrink 4 / autoFit 1 / layout 12 / transparency 16
rounded 2 / bar 17 / line 98 / pie 14 / isBrowser 0 / svg 0 / notes 7 / masterName 3 / LAYOUT_WIDE 2 / LAYOUT_16x9 1
```

### 9) bundle 体积（v4.0.1 tag 的 `dist/` 真实字节）

```text
=== 1. PptxGenJS v4.0.1 dist/ 文件真实体积（git tree @ tag） ===
dist/pptxgen.bundle.js	460889 bytes	450.1 KB
dist/pptxgen.bundle.js.map	473505 bytes	462.4 KB
dist/pptxgen.cjs.js	516944 bytes	504.8 KB
dist/pptxgen.es.js	516931 bytes	504.8 KB
dist/pptxgen.min.js	271010 bytes	264.7 KB
dist/pptxgen.min.js.map	280693 bytes	274.1 KB
--- types/ ---
types/index.d.ts	73191 bytes
```

### 10) `package.json` 的 `browser` 字段（浏览器兼容的真实机制）

```text
browser   = {"express":false,"fs":false,"https":false,"image-size":false,"node:fs":false,"node:https":false,"os":false,"path":false}
exports   = {"types":"./types/index.d.ts","import":"./dist/pptxgen.es.js","require":"./dist/pptxgen.cjs.js"}
engines   = null
deprecated= null
```

### 11) 活跃分支 `pptxgenjs-plus`（`.research\a-plus.ps1` 摘要）

```text
created = 2026-06-28T13:30:00Z  pushed = 2026-11-07T17:12:57Z  stars = 19
forks = 4  open_issues = 0  default_branch = next
--- latest commits ---
03549c56	2026-11-07T17:12:23Z	chore: release v4.3.7
a7963b11	2026-11-07T17:11:36Z	fix(notes): preserve speaker-note paragraph boundaries
d9e47edd	2026-11-02T20:11:35Z	chore: release v4.3.6
61a9cb41	2026-11-02T20:10:45Z	fix(media): accept prerendered SVG previews for worker exports
a4f0f933	2026-10-31T02:02:03Z	chore: release v4.3.5
8fa8e0e2	2026-10-31T02:00:24Z	Fix: Configure pie-charts data label color (#18)
64db82c9	2026-10-05T11:02:33Z	fix: bubble chart table ref spans every data row (#15)
--- releases ---
v4.3.7	2026-11-07T17:13:02Z
v4.3.6	2026-11-02T20:12:34Z
v4.3.5	2026-10-31T02:02:44Z
v4.3.4	2026-09-24T17:18:23Z
v4.3.3	2026-09-19T03:39:30Z
```
```text
=== npm: pptxgenjs-plus ===
version   = 4.3.6
license   = MIT
modified  = 2026-11-02T22:00:20.244Z
size      = 3853754
deps      = { pako: '^3.0.1', '@rgrove/parse-xml': '^4.2.3', '@node-projects/jszip': '^4.2.1' }
browser   = { fs: false, os: false, path: false, 'node:fs': false, 'node:http': false, 'node:https': false }
```
```text
=== fork lineage ===
fork      = False
parent    =
homepage  = https://lofcz.github.io/pptxgenjs-plus/
(zip: packages/pptxgenjs-jsx, packages/pptxgenjs-std)
```

### 12) 其它候选的 npm 数据

```text
=== npm: pptx-automizer ===
version   = 0.9.4
license   = MIT
modified  = 2026-09-28T12:10:50.502Z
size      = 1391374
deps      = { jszip: '^3.10.1', slugify: '^1.6.9', pptxgenjs: '^3.12.0', 'regexp.escape': '^2.0.1', '@xmldom/xmldom': '^0.9.10' }
browser   = (空)

=== npm: @shbernal/ts-pptx ===
version   = 4.1.0
modified  = 2026-10-11T09:16:19.510Z
size      = 6390603
deps      = { fflate: '^0.8.3', 'opentype.js': '^2.0.0', '@xmldom/xmldom': '^0.9.12' }
```

### 13) `ppt-master` 怎么产出 pptx（结构 + 依赖实测）

```text
=== root-level entries ===
blob	requirements.txt 724
tree	.claude-plugin / .github / docs / projects / skills
=== paths matching pptx|ooxml|slide（节选） ===
skills/ppt-master/scripts/pptx_ooxml/analyzer.py	12845
skills/ppt-master/scripts/pptx_ooxml/chart_read.py	3838
skills/ppt-master/scripts/pptx_ooxml/clone.py	36689
skills/ppt-master/scripts/pptx_ooxml/ooxml.py	12511
skills/ppt-master/scripts/pptx_ooxml/package.py	12336
skills/ppt-master/scripts/pptx_ooxml/slideshow.py	3161
skills/ppt-master/scripts/pptx_shapes/data/presetShapeDefinitions.xml	538970
skills/ppt-master/scripts/pptx_shapes/*.py (formula/loader/registry/semantics/...)
skills/ppt-master/scripts/pptx_animations.py	139139
skills/ppt-master/scripts/pptx_animation_presets.json	572130
skills/ppt-master/scripts/pptx_embedded_fonts.py	14102
skills/ppt-master/scripts/pptx_template_import.py	14294
skills/ppt-master/scripts/pptx_to_svg/converter.py	71278
skills/ppt-master/scripts/pptx_to_svg/chart_to_svg.py	122156
skills/ppt-master/scripts/confirm_ui/server.py	115933
file_count = 13173   truncated = False
```
```text
=== skills/ppt-master/requirements.txt（节选） ===
PyYAML>=6.0
python-pptx>=0.6.21          # 仅 svg_to_pptx.py 使用
XlsxWriter>=3.0.0
skia-pathops>=0.9.2
uharfbuzz>=0.50.0
edge-tts>=7.2.8
PyMuPDF ...   # License notice: PyMuPDF is AGPL-3.0
```

### 14) `genoffice` 自研 pptx 引擎 + `pptxgenjs` 仅作 devDependency（决定性旁证）

```text
packages = packages/agent-core, ai-provider, ai-search, cli, compound-file, doc2docx, docx-engine,
electron-utils, file-parse, font-metrics, html2docx, hwp2docx, i18n, odf2ooxml, pdf2docx, pipelines,
ppt2pptx, pptx-engine, pptx-ops, pptx-render, project-store, ui, xlsx-gateway, zip-gate
--- packages/pptx-engine（节选）---
packages/pptx-engine/src/chart.ts	68850
packages/pptx-engine/src/embedded-fonts.ts	14912
packages/pptx-engine/src/generate.ts	78725
packages/pptx-engine/src/index.ts	184945
packages/pptx-engine/src/insert.ts	28441
--- packages/pptx-render（节选）---
packages/pptx-render/src/build-chart.ts	156110
packages/pptx-render/src/text-layout.ts	76753
packages/pptx-render/src/render-tree.ts	25020
packages/pptx-render/src/metrics.ts	11278
packages/pptx-render/src/preset-geometry.ts	52737
```
```json
// packages/pptx-engine/package.json
{
  "name": "@genoffice/pptx-engine",
  "license": "Apache-2.0",
  "private": true,
  "description": "pptx parsing (Slide element tree with byte anchors + inheritance resolution), OOXML fragment generation, element-patch save",
  "dependencies": { "@genoffice/zip-gate": "*", "fast-xml-parser": "^5.3.4", "jszip": "^3.10.1", "@genoffice/agent-core": "*" },
  "devDependencies": { "@types/node": "^24.10.1", "pptxgenjs": "^4.0.1", "typescript": "^5.9.3", "vitest": "^4.1.12" }
}
```

### 15) `Kami` 的导出链路（README 原文 + deliver.py 实测）

```text
README: Kami (紙, かみ) means "paper" in Japanese. It gives AI agents layout rules and templates for PDF, PNG,
        and editable PowerPoint output, with nine built-in document templates and a product landing page.
README: - **Slides.** Three rendering paths: WeasyPrint HTML to PDF by default, python-pptx for editable PPTX
        on request, and a Marp variant in `skills/kami/assets/templates/marp/` for Markdown-first decks.
--- Kami paths matching 'pptx' / 'export' ---
(0 results)
--- deliver.py 关键行 ---
deliver.py L10: render the PDF next to the HTML through the shared render pipeline
deliver.py L47: from render import render_pdf
deliver.py L261: except Exception as exc:  # WeasyPrint and math failures both block delivery
```

### 16) 其它候选 issue 抽样（证明"停更/活跃"）

```text
=== issues: singerla/pptx-automizer ===
#215 CLOSED 2026-10-05 Chart's chartUserShapes drawing is copied without its own .rels file when cloning a slide
#186 CLOSED 2025-12-08 U+000B in text corrupts the PPT file
#183 CLOSED 2025-11-14 Release 0.8.0 - slide.getElement(...) no longer works with tables
=== issues: genspark-ai/genoffice（slider 相关） ===
#2191 CLOSED 2026-10-25 Slides: Support A4/A3 page sizes, portrait orientation, and custom dimensions
#2123 CLOSED 2026-10-21 slides: savePptxToFile truncates the deck in place, so a crash mid-save corrupts the file
#2394 CLOSED 2026-11-01 slides apply setText: runs land in separate paragraphs ...
#2177 CLOSED 2026-10-24 [Feature Request] Slides: Implement editing ribbon for Slide Master
#2508 OPEN   2026-11-05 [Slides] Support exporting presentations to video (MP4)
=== issues: hugohe3/ppt-master ===
#331 CLOSED 2026-10-28 动画导出：with-previous 后面的 after-previous 只等上一行结束...
#329 CLOSED 2026-10-27 mirror_template_materialize.py hard-fails on zero-size shapes from real-world PPTX
#325 CLOSED 2026-10-21 实时预览画布空白并误报 SVG 损坏：ElementTree 序列化输出 ns0: 前缀，innerHTML 无法渲染
#323 CLOSED 2026-10-21 Live preview renders blank: /api/slide re-serializes SVG as <ns0:svg>
=== issues: scanny/python-pptx（全 OPEN，最新 2026-11） ===
#1156 OPEN 2026-11-05 FreeformBuilder produces wildly distorted shapes due to coordinate/scale handling
#1134 OPEN 2026-06-02 Setting data_labels.position = XL_LABEL_POSITION.RIGHT breaks opening the presentation in Office 365 (web)
#1137 OPEN 2026-06-16 [Security] Path Traversal / Zip Slip in PackURI and _DirPkgReader / _ZipPkgWriter
=== issues: Ziv-Barber/officegen（最新一条止于 2024） ===
#421 OPEN 2024-12-04 How to put a chart side by side with a table?
#420 OPEN 2024-10-14 How can we add the external image in my Doc PLEASE HELP ME IN THIS.
```

### 17) 后继/相邻生态检索（`gh search repos`）

```text
=== gh search repos: pptxgenjs（sort updated，节选）===
gitbrent/PptxGenJS	6361	2025-11-28T20:17:14Z
lofcz/pptxgenjs-plus	19	2026-11-07T17:12:57Z	Build PowerPoint presentations with JavaScript. Works with Node, Browser, and more.
artifact-kit/pptxgenjs-jsx	33	2026-04-29T15:44:05Z	LLM-friendly JSX declaration layer for PptxGenJS
huangzhenhao90/pptx-deck-builder	17	2026-04-13T13:35:18Z
algerchen2024/image-to-editable-pptx	13	2026-10-12T05:34:18Z	ChatGPT Skill + portable PageIR/PptxGenJS workflow
anotb/pptx-masters	6	2026-02-25T21:29:01Z	Extract PptxGenJS slide masters from corporate PowerPoint templates
henryhyw/slidepoise	98	2026-10-23T16:04:08Z	... editable PowerPoint output
zythum/pptxgenjsx	11	2026-08-03T02:48:09Z	... render them to `.pptx` files
qybaihe/codex-ppt	51	2026-10-26T13:28:55Z	... editable PPTX presentations
=== gh search repos: "pptx generator"（sort stars，节选）===
singerla/pptx-automizer	253	2026-10-23T07:26:45Z	TypeScript
=== forks of PptxGenJS（sort stargazers）===
BapunHansdah/PptxGenJS	3	pushed=2025-11-25
NeomaVerwaltung/PptxGenJS	2	pushed=2026-09-10
shbernal/PptxGenJS	1	pushed=2026-07-24	Legacy - the final release of this fork is @shbernal/pptxgenjs v11.0.0 (deprecated on npm). Development continues as shbernal/ts-pptx.
```
→ 判读：PptxGenJS **生态仍在被大量 2026 年新项目使用**（说明引擎能力被认可），但**上游 fork 里没有能接班的活跃主线**（fork 最高 3 star；`shbernal` 那条明确说自己的 fork 已 deprecated、另起 `ts-pptx`，而 `shbernal/pptx-ts` 实测仅 5 star / npm `@shbernal/ts-pptx@4.1.0` / 2026-10-11 / 6.39MB）。目前**唯一有持续发版节奏的接班者是 `lofcz/pptxgenjs-plus`**。

---

*本文件仅为调研结论，不含产品代码；所有 star/license/日期均来自上方可复现命令的当次输出。*
