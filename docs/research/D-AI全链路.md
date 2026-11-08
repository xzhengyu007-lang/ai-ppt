# D 线调研：AI 全链路参考 + 许可证逐项核实

> 调研员：`research-ai-pipeline` ｜ 实测日期：**2026-11-09**（Asia/Shanghai）
> 范围：国内外 AI PPT 生成项目的**生成流水线 / 模板注入 / 导出路径 / 结构化输出 / 已踩的坑 / 安全**。
> **抄流程，不抄代码。** 本线不写产品代码、不 clone 仓库、不拷代码，只产出本文件。
> 所有 star / license / pushed_at 均来自本次真实执行的 `gh api`（见 §6 原始命令）。取不到的写 `未核实`。

---

## 0. 一句话结论（先看这个）

1. **五步流水线（brief → outline → slideSpec → layoutAssign → selfCheck）成立，而且我们比所有候选都更细，但"细分"这件事本身没有惩罚**——
   `ppt-master`（MIT，74872★）把同一件事拆成了 **7 步 + 2 道确认闸门 + 1 份 spec + 1 份 lock + 1 个本地校验器**，`dashi-ppt-skill`（AGPL，10489★）把它拆成 **15 步 + 3 个校验器**。**唯一没人在做的是"规则引擎选版式"这一步独立成层。**
2. **"让模型选版式"有明确反证**：`presenton`（Apache-2.0，11809★）就是模型选版式，然后 [#841](https://github.com/presenton/presenton/issues/841) 在 Gemma 4 上"封面页永远不被选中"。我们的规则引擎路线是**被这个坑逼出来的正解**，不是过度设计。
   真正的先例是 `dashi-ppt-skill` 的 `layout:query`（按页面角色 + 容量约束**查询**候选版式），但它被 AGPL 锁住。
3. **"模板即代码"是对的，而且有重量级佐证**：`genoffice`（Apache-2.0）源码注释直言 —— *"AI-generated decks usually ship a single empty layout, leaving the layout picker useless"*，于是它把 PowerPoint 原生占位符版式**代码化后注入 .pptx 包**。
   而"用户上传 .pptx 当母版"这条路的代价在 `presenton` [#1001](https://github.com/presenton/presenton/issues/1001)/[#754](https://github.com/presenton/presenton/issues/754)/[#781](https://github.com/presenton/presenton/issues/781) 和 `ppt-master` [#284](https://github.com/hugohe3/ppt-master/issues/284) 里被完整踩过一遍。
4. **LibreOffice：6 个候选里 2 个强依赖（LandPPT、PPTAgent），我们不需要背。** 导出主流是 **headless Chromium 量测 + PptxGenJS/自研 OOXML**，或 **python-pptx 直写**。二者都不需要 LibreOffice。
5. **许可证红线**：`dashi-ppt-skill` 是 **AGPL-3.0 ⚠️**、`tldraw` 是**非开源商业许可（禁止生产环境）⚠️**、`presenton` 的**导出核心仓库 `presenton/presenton-export` 无任何 LICENSE** ⚠️。
   **`LandPPT` 的 NOASSERTION 已读全文定性：是 Apache-2.0 的改写版，不是 GPL/AGPL**（细节见 §2）。

---

## 1. 候选总表（8 列固定）

> 「迁移落点」列说明：本项目当前工作区只有 `docs/`、`scripts/`、`.research/`，**尚无产品代码**（已实测）。因此该列给的是"若移植此机制，建议落到哪个待建文件"，属**设计建议**，不是既成路径。

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件（建议落点） | 坑 |
|---|---|---|---|---|---|---|---|
| **`genspark-ai/genoffice`**<br>11958★ | 11958 | **Apache-2.0** | 2026-11-08T02:35:37Z | TypeScript | ① **BYOK + 本地生成真 .pptx**，形态与我们完全一致；② `packages/pptx-engine/` 是从零写的 TS OOXML 引擎（`generate.ts` 78KB、`parse.ts` 176KB、`placeholder.ts`、`layout.ts`、`master-edit.ts`）；③ `builtin-layouts.ts` 把**原生占位符版式代码化后注入 .pptx 包**；④ 成熟的 **payload redactor**（`agent-core/redact-core`）；⑤ **完全不需要 LibreOffice** | `src/export/pptx/`（自研 OOXML 写盘）、`src/layout/builtin-layouts.ts`（版式→占位符物化）、`src/security/redact.ts`（prompt/日志脱敏）、`src/settings/ai-config.ts`（Key 存储） | 体积巨大（Apache 全功能办公套件，非纯 PPT）；**Key 存普通设置文件，代码搜索无 `safeStorage`/`keytar`**（未接 OS 钥匙串）；redactor 曾漏掉常见密钥形态（#727）；BYOK 只保首轮（#1948） |
| **`hugohe3/ppt-master`**<br>74872★ | 74872 | **MIT** | 2026-11-08T10:38:28Z | Python | ① **最完整的分段流水线先例**：7 步 + 2 道确认闸门 + Design Spec + spec_lock + `project_manager.py validate`；② SVG 页设计 → **原生 DrawingML** 转换（形状/图表/表格/动画全是原生对象）；③ 模板 = **Design Spec markdown + 资源**，不是 .pptx 母版；④ 版式库 `templates/layouts/`：`layouts_index.json` + 6 个命名集合（`presentation_core` / `report_core` / `editorial_bleed` / `moments_square` / `story_vertical` / `xiaohongshu_post`），页面的 `page_layouts` 带 **atoms / slots 契约**（见 workflow 第 267 行）；⑤ **不要 LibreOffice** | `src/pipeline/stages/*`（对照其 Step1–7）、`src/templates/spec/`（Design Spec 与 lock）、`src/layout/layouts-index.json`、`src/validate/spec-validator.ts`、`src/templates/confirm-gate.ts` | 它是 **agent skill（喂给 Claude Code/Codex 的 markdown 指令集）**，不是带 UI 的服务；重度依赖宿主 agent 的能力；可选依赖 **PyMuPDF = AGPL-3.0**；中文全角标点折行估算错（#293） |
| **`presenton/presenton`**<br>11809★ | 11809 | **Apache-2.0**（但导出核心另见 §2） | 2026-11-06T05:46:19Z | TypeScript | ① 唯一"开箱即用自部署服务"形态（FastAPI + Next.js + Docker）；② `layouts.json`（252KB）**版式即数据**：元素绝对坐标树，由上传的 .pptx 反解而来；③ 16 套代码化模板 `templates/`；④ `jsonrepair` 兜底 JSON；⑤ `dirtyjson` + SSE 流式；⑥ **不要 LibreOffice**（用 Chromium 量测） | `src/templates/layouts.schema.ts`（元素树 schema）、`src/llm/structured.ts`（jsonrepair 兜底）、`src/export/html-to-pptx.ts`、`src/templates/pptx-import.ts`（.pptx→元素树） | **模型选版式 → 小模型直接失效**（#841）；**一次性吐整份 deck 撞输出上限**（#951）；**CJK 三重坑**（#940/#904/#747）；4 条安全 issue（#972–#975）+ 提交过 token（#769）；导出核心 `presenton-export` **无许可证**；Docker 镜像锁 Chromium 149，48 个 critical CVE（#1007） |
| **`icip-cas/PPTAgent`**<br>5225★ | 5225 | **MIT** | 2026-11-02T22:05:04Z | Python | ① 论文级框架：**两阶段 edit-based**——先分析**参考演示文稿**抽取"页级功能类型 + 内容 schema"，再出大纲、逐步生成**编辑动作**改已有页；② 天然支持"用现成 .pptx 当模板"；③ 有 INSPECTION（视觉检查）反思环；④ PPTEval 三维评测（Content/Design/Coherence） | `src/templates/pptx-schema-extract.ts`（参考 deck → 功能类型 + schema）、`src/pipeline/edit-actions.ts`、`src/selfcheck/reflection-loop.ts`、`src/eval/ppteval.ts` | **必须常驻 LibreOffice**（README 明列为 requirement，`shutil.which("libreoffice")` 写进健康检查）；镜像 **25.2 GB**（#58）；需自建 `python-pptx` fork（#146）；反思环会死循环（#243 反复 INSPECTION_FAILED）；**MIT 有传染质疑**（#180：用了 MinerU 理应 AGPL） |
| **`sligter/LandPPT`**<br>3644★ | 3644 | **NOASSERTION** → 实测为 **Apache-2.0 改写版**（见 §2） | 2026-11-08T03:37:27Z | Python | ① **最贴近中文场景**（中文 UI、中文模板、国内模型适配）；② 完整 Docker/Helm 部署编排（含 `pptx-renderer` sidecar）；③ 模板包 workspace 工具链（`scripts/template_package_*.py`）；④ token 消耗的真实教训（#27/#89） | 参考其**部署编排与 sidecar 隔离思路**；`src/render/`（我们不抄，只读设计） | **强依赖 LibreOffice**（专用容器 `libreoffice-impress`）+ **商业 SDK Apryse**（`apryse-sdk>=11.6.0`，需付费 key，#57/#58/#19）；编辑器代码**不开源**（#88）；**源码自编译仍要邀请码**（#110）；导出曾只能给 HTML 压缩包（#43）；图片 base64 塞 prompt 导致单页 600K–1000K token（#89） |
| **`chuspeeism/dashi-ppt-skill`**<br>10489★ | 10489 | **AGPL-3.0** ⚠️ | 2026-11-06T08:26:30Z | JavaScript | ① **和我们五步最像的分段**：目标提炼 → themePack → PageContentPack → `goal:scaffold` → 渲染 → 3 个校验器 → 最多 2 轮返工 → 阻塞；② **`layout:query`：按页面角色 + 容量约束查询候选版式**（规则式选版式的唯一先例）；③ **`copyBudgets`：文案长度预算，超长被 `goal-spec` 拦截**（= 我们的"标题≤28字/要点≤40字"）；④ `props:safe` 安全写入 | `src/layout/query.ts`（版式查询规则）、`src/slide-spec/budgets.ts`（中文/英文双阈值）、`src/selfcheck/report-all.ts`（一次报全部错误）、`src/pipeline/retry.ts` | **⚠️ AGPL-3.0，只能读设计**；且 [#43](https://github.com/chuspeeism/dashi-ppt-skill/issues/43) 用户指出"开源了个壳子"，**主题包/导出引擎是打包产物不可改**；校验器"挤牙膏"（#17）；中文字长限制按英文设计（#15）；版式编号无意义导致盲选（#16）；预览与导出字体不一致（#22） |

> 备选未深挖：`allweonedev/presentation-ai`（实测 `3074★ / MIT / 2026-06-05T05:57:37Z / TypeScript / 0 open issues`）—— 距今天约 5 个月无提交，且 open issues 为 0，不推荐作为主干参考。

---

## 2. 许可证核实

全部通过 `gh api repos/OWNER/REPO/license` 读**全文**（base64 解码落盘到 `.research/lic/`），不是只看 `spdx_id`。

| 仓库 | `spdx_id` | 实测 LICENSE 名称 / 字节（API `size`） | 全文判读要点 | 结论 |
|---|---|---|---|---|
| `genspark-ai/genoffice` | `Apache-2.0` | `Apache License 2.0` / **11345 B** | 与标准 Apache-2.0 逐行比对，**仅 2 行差异**（就差版权行）。仓库另有 `NOTICE`（2489 B）、`SECURITY.md`、`PRIVACY.md` | ✅ **可依赖** |
| `hugohe3/ppt-master` | `MIT` | `MIT License` / **1069 B** | 标准 MIT 原文 | ✅ **可依赖**（代码）<br>⚠️ 但其**可选依赖 `PyMuPDF` 是 AGPL-3.0**，项目在 `requirements.txt` 里自己标了警告：*"review the AGPL terms before redistributing a bundle that includes it"*。若我们不分发 PDF 解析能力即可规避 |
| `presenton/presenton` | `Apache-2.0` | `Apache License 2.0` / **11340 B** | 标准 Apache-2.0 原文（另有 1.2 MB `NOTICE`，是前端依赖清单） | ✅ **可依赖**（仓库代码） |
| **`presenton/presenton-export`**<br>（presenton 的导出核心） | **无 LICENSE** | `gh api .../license` → **HTTP 404 Not Found** | 该仓库根目录**只有一个 72 B 的 README**，无源码、无许可证，只挂 release 产物（`v1.0.53` 起，每版 1 个 asset）。`presenton` 的 `Dockerfile` 在构建期从该仓库 release 下载 `@presenton/export-core` | ⚠️ **禁用（作为代码参考）**：**导出实现既不开放源码，也无许可证**。Apache-2.0 **不覆盖**这部分。可以"用"，不能"抄"，甚至没法读 |
| `icip-cas/PPTAgent` | `MIT` | `MIT License` / **1065 B** | 标准 MIT 原文 | ✅ **可依赖**<br>⚠️ 保留意见：[#180](https://github.com/icip-cas/PPTAgent/issues/180) 社区质疑"如果用了 MinerU，整个项目的协议就应该是 AGPL 而不能是 MIT"。若我们**只用它的设计思路**（两阶段 edit-based）则无风险；**不要**因此去用 MinerU |
| **`sligter/LandPPT`** | **`NOASSERTION`**（gh 名称显示 `Other`） | **首行是 `Apache License`**（Version 2.0, January 2004）/ **11574 B** | **已读全文 207 行并逐行 diff**。与标准 Apache-2.0（11345 B）差异：**仅 21 行 LandPPT 独有 / 17 行标准独有**，且全是**机械改写**，不是新增条款：<br>① §1 `Licensor` 定义被截短（删掉 `...authorized by the copyright owner that is granting the License`）；<br>② §2 授权动作被**替换成 MIT 式**：Apache 的 `reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute` → 换成 `use, reproduce, modify, merge, publish, distribute, sublicense, and/or sell`；<br>③ 附录样板删掉 `(an example is provided in the Appendix below)`；<br>④ §9 标题 `Accepting Warranty or Additional Liability` → `Additional Support`；<br>⑤ 版权行 `Copyright [2024] [LandPPT Team]`。<br>**关键词扫描（GNU / GPL / copyleft / Commons Clause / non-commercial / network use / SaaS / may not sell / commercial）：除标准免责段里的 "commercial damages" 外零命中。** | ✅ **判定：Apache-2.0 的改写版，非 GPL / 非 AGPL，无 copyleft、无商用限制、无 Commons Clause。**<br>→ **可读设计，也可依赖**；但因文本被改写过、非 SPDX 标准文本，**署名合规存在歧义**（gh 因此无法判定为 Apache-2.0）。<br>实操建议：**按 Apache-2.0 对待**（保留版权声明 + NOTICE + 变更声明），**且优先只抄流程设计** |
| `chuspeeism/dashi-ppt-skill` | `AGPL-3.0` | `GNU Affero General Public License v3.0` / **34523 B** | 标准 AGPL-3.0 全文 | ⚠️ **仅可读设计，禁用作依赖 / 禁拷代码。**<br>**知识参考，非依赖。**<br>AGPL 的网络条款会传染到我们的服务端；且 [#43](https://github.com/chuspeeism/dashi-ppt-skill/issues/43) 显示其**主题包与导出引擎本身就是打包产物**，即便想合规复用也拿不到可改源码 |
| **`tldraw/tldraw`**<br>（若曾考虑用其做预览/编辑画布） | **`NOASSERTION`**（`Other`） | **`# tldraw license`** / **4609 B** | 读完 71 行全文。**非 OSI 开源许可**，是 tldraw Inc. 的**源码可见商业许可**：<br>• 允许：Development Environment 使用、修改、随项目打包；<br>• **禁止：`Not to use the Software in Production Environments`**；<br>• 禁止：干扰 License Key 校验；<br>• 技术强制：内置 License Key 校验、**环境探测**、`watermark display`，并**回传使用数据**；<br>• 治理法：Delaware | 🚫 **禁用**（除非购买商业许可）。<br>**这一条必须写进选型红线：网页预览/可微调画布不能用 tldraw，否则产品上线即违约。** 替代：`presenton` 用 `konva`/`react-konva`（MIT），或纯 CSS 绝对定位渲染 |

### 许可证地图（一句话）
**可依赖（代码）**：genoffice、ppt-master、presenton（主仓）、PPTAgent、LandPPT（按 Apache-2.0 对待）。
**仅可读设计**：dashi-ppt-skill（AGPL ⚠️）、presenton-export（无许可证 ⚠️）。
**禁用**：tldraw（生产环境违约 ⚠️）。

---

## 3. 逐项回答必答问题

### Q1. 流水线分段有没有先例？我们更细还是更粗？有没有"规则引擎选版式"？

**有先例，而且我们不是最细的。**

| 我们的五步 | `ppt-master`（MIT，7 步） | `dashi-ppt-skill`（AGPL，15 步） | `presenton`（Apache-2.0） | `PPTAgent`（MIT） |
|---|---|---|---|---|
| `brief`（受众/场景/时长/页数/语言/风格） | Step 1 源处理 + Step 4 **Stage 1 确认"沟通契约"**（受众/意图/产出/场景/afterlife） | 步骤 1 提炼 title/goal/audience/owner/页数；步骤 2 确认 themePack | ❌ 无独立段，混在提示词里 | 无（论文里是 outline 前置） |
| `outline`（8–14 页 + 行动式标题） | Step 4 内 **page roster**（页清单） | 步骤 4 `page-content-pack.json` 逐页语义 brief | 有（`generate_presentation_outlines.py`） | ✅ 明确"先出 outline" |
| `slideSpec`（槽位填空，带字数预算） | **`design_spec.md`（I–X 十节）+ `spec_lock.md`** ← 双产物 | **`PageContentPack` + `goal.json`（schemaVersion 2）**，带 `copyBudgets` | 元素树填文本 | **"页级功能类型 + 内容 schema"** |
| `layoutAssign`（**规则引擎**） | **模型决定**：`mirror`/`layout`/`adaptive` 三档，"adaptive uses a **Strategist-declared** Layout" | **`layout:query` 按角色 + 容量查询候选** ← **最接近规则的先例** | **模型决定**（→ #841 翻车） | 从参考 deck 提取的 schema 里挑 |
| `selfCheck`（模型 + 本地校验器） | `project_manager.py validate` + Gate 1/Gate 2 + `visual-review` / `verify-charts` stage | **3 个校验器**：`validate:goal-spec` / `validate:swiss` / `validate:goal-copy` + `props:safe` | 弱（撞 token 上限才报错 #951） | **INSPECTION 反思环**（会死循环 #243） |
| 两段式（先出大纲确认，再逐页生成） | ✅ **⛔ BLOCKING 两阶段确认**（Stage 1 契约 + Stage 2 完整方案），另有 `refine-spec` 第三道闸 | ✅ 多轮确认 + 最多 2 轮返工 | ❌ 一次性 | 部分 |

**结论：**
- **分段 + 可确认有强先例**，`ppt-master` 的"两阶段 BLOCKING 确认"几乎是我们交互模型的镜像；`dashi` 的"spec + 3 校验器 + 最多 2 轮返工 + 阻塞"是我们 `selfCheck` 的完整参考实现思路（只能读）。
- **我们的五步相对 `ppt-master` 7 步 = 略粗**（我们把它 Step1+Step3 合并进 brief，把 Step5/6 收进"逐页生成"），**相对 `presenton` = 明显更细**。
- **"规则引擎选版式"是唯一没有成熟先例的一步**，但有两面佐证：
  - **反证（支持我们）**：`presenton` 把版式选择交给 LLM，[#841](https://github.com/presenton/presenton/issues/841) "Doesn't Select Title Slide on Some Models" —— Gemma 4 上封面版式**永不被选中**，issue 作者的建议是"再把 prompt 写清楚点"。这是"用 prompt 修确定性 bug"的死路。
  - **正证（同类做法存在）**：`dashi-ppt-skill` 的 `layout:query` 用**页面角色 + `copyBudgets`/`mediaSlots` 容量约束**从 manifest 里**查询**候选版式，而不是让模型自由命名。它的痛点恰恰是**查询结果不可解释**（[#16](https://github.com/chuspeeism/dashi-ppt-skill/issues/16)："layout 以 `theme02_page001` 命名，用户无法判断用途，只能盲选，换 3 次才成功"）。
  - **对我们的直接要求**：规则引擎的版式 ID **必须语义化**（`statement-3point` 而不是 `layout_07`），且必须能**输出"为什么选它 + 落选原因"**——否则我们会重犯 dashi #16。

### Q2. 模板注入方式：.pptx 母版占位符 / HTML / 代码化 layout？各自代价？

四条路线，全部有实证：

| 路线 | 代表 | 实现 | 代价（实证） |
|---|---|---|---|
| **A. 代码化 layout（= 我们选的）** | `genoffice`、`presenton` 的 16 套内置模板、`dashi` 的 themePack | 版式 = 代码/JSON 里的**语义槽位**定义，导出时物化为 pptx 的 Master/Layout/Placeholder 部件 | **优点**：可控、可校验、可加字数预算。<br>**代价**：版式库要自己养。`genoffice` 源码注释是最好的一句话佐证：*"AI-generated decks usually ship a single empty layout, leaving the layout picker useless. These definitions mirror the Office default template's placeholder geometry (16:9 base, scaled to the actual slide size) and are **injected into the package on first use: layout part + rels + [Content_Types] override + slideMaster registration**, so the result is a regular layout PowerPoint also understands."* |
| **B. 上传 .pptx 当母版 → 占位符替换** | `PPTAgent`（参考 deck 抽 schema）、`presenton` 的 custom template | 解析 .pptx，反解出 layout/schema，再回填 | **代价极高**：`presenton` [#1001](https://github.com/presenton/presenton/issues/1001) 上传 pptx 建模板时**字体检测报错**；[#754](https://github.com/presenton/presenton/issues/754)（9 条讨论）"Creating Own Presentation Templates" 长期未解；[#781](https://github.com/presenton/presenton/issues/781) **自定义模板功能离线不可用**（要联网拉字体/图标）。<br>`ppt-master` [#284](https://github.com/hugohe3/ppt-master/issues/284)：用自己的模板做 PPT 仍然**文字覆盖、排版错位**，用户只能问"要怎样调整自己的模板"——**把不确定性甩给了用户**。 |
| **C. HTML/CSS 模板 + 浏览器量测导出** | `presenton`、`dashi`（`html-deck-to-pptx`） | HTML 渲染 → headless Chromium 量测每个元素的 box → 写 OOXML | **优点**：预览与导出共用一个渲染器，**所见即所得**。<br>**代价**：页面里的"文字换行"是浏览器的排版结果，写进 pptx 后**由 PowerPoint 重新排版**，两者必然漂移。`presenton` [#904](https://github.com/presenton/presenton/issues/904)"HTML-to-PPTX export differs significantly from preview for **Chinese** decks on Windows PowerPoint"、`dashi` [#22](https://github.com/chuspeeism/dashi-ppt-skill/issues/22)"导出的 PPT 文件字体与 html 预览不一致" 都是这条路的**结构性缺陷**，不是 bug。 |
| **D. SVG 页设计 → 原生 DrawingML** | `ppt-master` | 每页画成 SVG（`svg_output/`），`svg_to_pptx.py` 逐元素转成可编辑原生形状 | **优点**：纯 Python，**不需要浏览器也不需要 LibreOffice**，产物全是原生可编辑对象。<br>**代价**：要自己实现 SVG 子集 → DrawingML 的映射，且**文字度量必须自己算**——`ppt-master` [#293](https://github.com/hugohe3/ppt-master/issues/293) 中文全角标点（`——`、`""`）宽度估算偏低导致单行文本框被折行；[#199](https://github.com/hugohe3/ppt-master/issues/199) 转换器忽略 letter-spacing、低估衬线字数宽度导致溢出；[#143](https://github.com/hugohe3/ppt-master/issues/143) 文字渐变填充在 SVG 转换时丢失。 |

**"模板即代码（Theme/Layout/Content 三层）+ 12 套 × 8 版式" vs "用户上传 .pptx 当母版" 的取舍（本线判定）：**

| 维度 | 模板即代码（我们） | 用户上传 .pptx |
|---|---|---|
| 可控性 | 高：槽位、字数预算、溢出规则全在手里 | 低：用户模板千奇百怪，`ppt-master` #284 证明"排版错位"会甩给用户 |
| 上线速度 | 快：不用写 .pptx 解析器 | 慢：需要 .pptx→内部模型的反解器 + 字体识别 + 图标提取（presenton 用了 `pptx-to-json` + `pptx-to-html` 两条链） |
| 中文风险 | 可控：我们自己定字体栈（Noto Sans CJK 等） | 高风险：模板里写死 SimSun/宋体，`genoffice` [#2449](https://github.com/genspark-ai/genoffice/issues/2449) 证实**CJK 字体按中文本地化族名引用会回退到 SimSun**，[#2390](https://github.com/genspark-ai/genoffice/issues/2390) 同族问题 |
| 差异化 | 版式库是我们的护城河 | 用户模板 = 商品化，无差异 |
| **结论** | **✅ 第一期只做模板即代码。** 把"上传 .pptx"放到后续版本，且届时**必须**先做"模板体检"（字体可用性 / 版式是否含占位符 / 是否有重叠），体检不过就拒绝，而不是让用户在生成后才发现排版错位 | |

**另外一条硬约束（`ppt-master` routing.md 的 Hard rule，值得直接抄进我们的设计）**：
> *"an existing PPTX or SVG is never upgraded in place by adding Master/Layout/placeholder structure — run create-template for a separate validated workspace, then author new structured pages."*

即：**绝不在用户的 .pptx 上原地加结构**，必须先转成一个"校验过的独立 workspace"。这条规矩能挡住上面所有 #284 类事故。

### Q3. 导出实现路径 —— 要不要背 LibreOffice？

**统计（6 个主干候选）：**

| 候选 | 导出实现 | **必须常驻 LibreOffice？** | 依据 |
|---|---|---|---|
| `genspark-ai/genoffice` | **自研 TS OOXML 引擎**（`packages/pptx-engine/src/generate.ts` 78KB / `parse.ts` 176KB） | ❌ **不需要** | 全仓 code search `soffice`/`libreoffice` 仅命中**注释、错误提示、测试 fixture**，无运行时依赖 |
| `hugohe3/ppt-master` | **SVG → 原生 DrawingML**（`svg_to_pptx.py`，`python-pptx` + `skia-pathops` + `uharfbuzz`） | ❌ **不需要** | `requirements.txt` 无任何 office 套件；LibreOffice 只在**用户报 issue 时作为外部复现工具**出现 |
| `presenton/presenton` | **headless Chromium 量测 + `@presenton/export-core`**（Docker 装 `chromium=149.*`，`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`）；模板/字体处理用 `python-pptx` | ❌ **不需要** | Dockerfile 全文无 libreoffice；`gh search code soffice` → **0 命中** |
| `chuspeeism/dashi-ppt-skill` | **`html-deck-to-pptx`：Playwright/Chromium + `pptxgenjs ^4.0.1`** | ❌ **不需要** | 导出走 `exportEditablePptxFromPage(page)`；脚本里只有 `PLAYWRIGHT_DOWNLOAD_HOST` 镜像配置 |
| **`icip-cas/PPTAgent`** | `python-pptx`（**需自建 fork**，见 #146）+ 视觉检查 | ✅ **要** | README 明写 *"LibreOffice available as `libreoffice` on PATH"*；`skills/pptagent/scripts/pptagent.py` 里 `checks["command:libreoffice"] = shutil.which("libreoffice") is not None` |
| **`sligter/LandPPT`** | `python-pptx` + **Playwright** + **`apryse-sdk>=11.6.0`（商业 SDK）** + **LibreOffice sidecar** | ✅ **要** | `docker-compose-pptx.yaml` 起 `pptx-renderer` 服务，其 `scripts/pptx-renderer/Dockerfile` 就是 `apt-get install libreoffice-impress fonts-noto-cjk`；`pyproject.toml` L73–74 = `playwright` + `apryse-sdk` |

**统计结果：6 个候选中 2 个（33%）强依赖 LibreOffice 常驻 —— `LandPPT` 与 `PPTAgent`。**

**成本论证（本机实测无 LibreOffice、无 Docker）：**
- `LandPPT` 的 LibreOffice 不是"装一下"就行，它被包在**独立容器**里：`read_only: true` + `cap_drop: [ALL]` + `network_mode: none` + `mem_limit: 1g` + `cpus: 1.0` + `pids_limit: 128` + **共享 spool 卷 + 一个 init 容器 chown**。要复刻这套隔离，等于把部署复杂度直接抬一个档。
- 更致命的是 **Apryse**：`apryse-sdk` 是**付费商业 SDK**，LandPPT 的导出能力被它锁住 → [#57](https://github.com/sligter/LandPPT/issues/57)"导出 pdf 和 ppt 报错，已经配置了 Apryse key"、[#58](https://github.com/sligter/LandPPT/issues/58)"是否可以支持 apryse 以外的 pptx 导出方法"、[#19](https://github.com/sligter/LandPPT/issues/19)"**Apryse 没有 MacOS 的轮子**"。
- `PPTAgent` 的 LibreOffice 是**全链路前置条件**（连健康检查都查它），且参考镜像是 **25.2 GB**（[#58](https://github.com/icip-cas/PPTAgent/issues/58)）。本地 4090 部署仍失败（[#213](https://github.com/icip-cas/PPTAgent/issues/213)）。

**✅ 本线结论：我们不背 LibreOffice。** 走 **"导出层只写 OOXML，不解释排版"** 的路线：
- **首选**：`pptxgenjs`（MIT，6361★，`gitbrent/PptxGenJS`）或**直接写 DrawingML**——`dashi` 与 `presenton` 都证明了 PPTX 可以在纯 JS/Node 里产出；
- **不需要** Chromium 常驻，**更不需要** LibreOffice：我们的版式是**代码化的固定槽位**，几何在代码里就是确定的，不需要"先渲染再看结果"。
- 若后续要做"导出与预览一致性校验"，再用**一次性的** headless 渲染（不是常驻），且把它当 CI 检查而不是运行时依赖。

### Q4. LLM 结构化输出与重试

**这是国内项目翻车最多的地方，值得逐条抄教训。**

| 做法 | 谁在用 | 实证 |
|---|---|---|
| **`response_format=json_schema strict`** 为主，**但兼容层必须能降级** | `presenton` | [#748](https://github.com/presenton/presenton/issues/748) 是最有价值的一篇：*"Affects **every** provider that differs from OpenAI on any of these three dimensions: streaming, `json_schema strict`, or `thinking` honouring."* 实测 MiniMax-M3：`stream=true` 却返回单个完整 JSON；`json_schema strict=true` 直接 400 拒绝或忽略返回散文；`thinking` 关了仍往 `content` 里塞 ` ```思考``` ` 块。作者点名 **DeepSeek-MoE、Moonshot、智谱、Yi、百川** 同型风险 |
| **`dirtyjson` / `jsonrepair` 兜底解析** | `presenton`（`dirtyjson.loads` + 前端 `jsonrepair ^3.12.0`） | 同上 #748：错误面是 `Expecting value: line 1 column 1 (char 0)`，**根因在上游流式解析**，兜底只掩盖症状 |
| **严格 JSON Schema，schema 本身也可能是错因** | `ppt-master` | [#205](https://github.com/hugohe3/ppt-master/issues/205)：*"schema must be a JSON Schema of `type: "object"`, got `type: null`"* —— 用户的 Codex 代理在转发时把 function schema 弄坏了。**说明：schema 要自己校验一次再发出去** |
| **视觉/结构检查 + 反思重试** | `PPTAgent` | [#243](https://github.com/icip-cas/PPTAgent/issues/243)「反复 INSPECTION_FAILED」——**反思环没有重试上限就会死循环**。必须设 `maxRetries` + 退出条件 |
| **最多 2 轮返工，超了标"阻塞"** | `dashi-ppt-skill` | SKILL.md 明写：*"默认最多修正 2 轮。验收通过后才能交付；两轮后仍不通过则标记'阻塞'，说明未达标项和阻塞原因，**不得将其表述为已完成成果**"* ← **这句直接抄**，正好治我们"生成不出合格页"的场景 |
| **校验器必须一次报全部错误** | `dashi-ppt-skill` | [#17](https://github.com/chuspeeism/dashi-ppt-skill/issues/17)「校验器'挤牙膏'——一次只暴露部分错误」，用户要走 4–6 轮才能从 `ok:false` 到 `ok:true`。**我们的 selfCheck 必须一次吐出全部违规项** |
| **字数预算要分中文/英文** | `dashi-ppt-skill` | [#15](https://github.com/chuspeeism/dashi-ppt-skill/issues/15)：`tags ≤ 18 字符`是按英文单词设计的 → 英文 18 字符≈3 个词够用，**中文 18 字符只够 9 个字**。建议"中文按 UTF-8 字符数 × 2 折算"。**我们的"标题≤28字 / 要点≤3条每条≤40字"必须按字符（不是 token、不是字节）计，且中英混排要单独处理** |
| **"降级为该页标题+要点"的先例** | 有，但是**隐式**的 | `presenton` [#951](https://github.com/presenton/presenton/issues/951)：整份 "Smart slide" 一次生成，撞输出 token 上限后直接 422 失败，**没有页面级降级**。`ppt-master` 的 split 模式（`resume-execute`）+ `failure-recovery.md` 更接近"局部失败不拖垮全局"。**→ 我们的逐页生成 + 单页降级是相对空白区的改进，值得写进设计** |
| **mock / 离线模式** | `presenton` | 有：Electron/桌面版 + MCP server；[#781](https://github.com/presenton/presenton/issues/781) 反而暴露"自定义模板功能离线不可用"。`PPTAgent` 有 `--offline`（README News：「Freeform & template generation now support PPTX export and **offline mode**」）。**→ 我们要做 mock provider（固定 JSON 返回）用于本地开发与自检，这是廉价的** |

**本线建议的约束顺序（比任何候选都稳）：**
1. 先 `response_format: json_schema` + `strict: true`（首选路径）；
2. 解析失败 → **不重试同一请求**，而是**降级到"无 schema 但强约束的文本协议"**（要求纯 JSON、禁 markdown fence），配合 `jsonrepair`；
3. 再失败 → **降级到该页"标题 + 要点"最小 spec**，并在 UI 上标"此行已降级"；
4. 单页失败**不阻断整份 deck**，累计 3 页降级则提示用户换模型；
5. 每次请求记录 `provider / model / 是否用了 schema / 是否降级`，便于事后归因（`presenton` #748 的教训：不给这些打点就无法定位）。

### Q5. 踩过的坑（每个主干 ≥2 个真实 issue）

> 全部 issue 编号均经 `gh api repos/OWNER/REPO/issues/N` 逐个核实存在（见 §6 第 5 条输出，**57 个全部命中，无一 404**）。

#### 5.1 `presenton/presenton`（Apache-2.0，11809★）

**中文支持差（三重坑，一条比一条狠）**
- https://github.com/presenton/presenton/issues/940 — `[Bug]: CJK text is clipped in exported PPTX — template line_height < 1.0 makes the line box shorter than the glyphs`（**open**，0 回复）
- https://github.com/presenton/presenton/issues/904 — `[Bug]: HTML-to-PPTX export differs significantly from preview for Chinese decks on Windows PowerPoint`
- https://github.com/presenton/presenton/issues/747 — `PPTX export shows CJK (Chinese/Japanese/Korean) text as garbled on macOS, LibreOffice, Google Slides`

→ **对本项目影响（最高优先级）**：三条坑分别对应我们的三个必答题：
① **行高**：CJK 字形高度 > 拉丁，`line-height < 1.0` 会裁字。我们的版式引擎必须给**中文字体单独的行高下限**（≥1.2），并且**导出时写死 `lnSpc`**，不能依赖渲染器默认。
② **预览 ≠ 导出**：只要我们走 "HTML 预览 + OOXML 导出" 双渲染器，这个差异就是结构性的。规避办法 = **导出层不解释排版**（版式几何在代码里确定，文字盒子尺寸由我们给定，不靠浏览器测量）。
③ **字体族名**：绝不能写"宋体/微软雅黑"这种本地化族名（`genoffice` #2449 已证会回退 SimSun）。**统一写 Noto Sans CJK SC / Noto Serif CJK SC + `eastAsia` 属性**。

**导出损坏 / 需要修复**
- https://github.com/presenton/presenton/issues/992 — `[Bug]: Windows Store app 0.9.11-beta: PDF and PPTX export fail with spawn EINVAL`
- https://github.com/presenton/presenton/issues/705 — `[Bug] Export to PDF/PPTX fails in Microsoft Store version (Chromium preparation error)`
- https://github.com/presenton/presenton/issues/1007 — `Docker image pins Chromium 149 (Debian snapshot 2026-06-25): 48 critical CVEs in the export browser`（**open**）

→ **影响**：`#992`/`#705` 的根因是**导出依赖宿主 Chromium**——平台差异会变成导出失败。`#1007` 更严重：**把 Chromium 打进交付物 = 把 48 个 critical CVE 打进交付物**，而且为了复现性必须 pin 版本，pin 了就修不动。**这是"不要 Chromium 常驻"的第二个理由（第一个是体积）。**

**token 成本高 / 一次性吐完**
- https://github.com/presenton/presenton/issues/951 — `The model reached its output-token limit before producing a complete Smart slide.`（整份 deck 一次生成，95% 时 422 失败，无页面级降级）
- https://github.com/presenton/presenton/issues/845 — `[Bug]: Max tokens set to 8192`（默认上限太小）

→ **影响**：**我们的"逐页生成"直接消灭这一类失败**。这是五步流水线里最没有争议的一步。

**结构化输出（见 Q4）**
- https://github.com/presenton/presenton/issues/748 — `Outline generation fails with "Expecting value" on non-OpenAI providers`
- https://github.com/presenton/presenton/issues/800 — `[Bug] Gemini via New API ignores json_schema required by structured generation`

**模型选版式不可靠（我们规则引擎的反证）**
- https://github.com/presenton/presenton/issues/841 — `[Bug]: Doesn't Select Title Slide on Some Models`（Gemma 4 上封面版式永不被选中）

**模板注入**
- https://github.com/presenton/presenton/issues/1001 — `[Bug]: Error detecting fonts when uploading pptx for template creation`
- https://github.com/presenton/presenton/issues/754 — `[Bug]: Creating Own Presentation Templates in Presenton`（9 条讨论）
- https://github.com/presenton/presenton/issues/781 — `Custom templates feature doesn't work offline.`（6 条讨论）

→ **影响**：这三条是"用户上传 .pptx 当母版"的**完整成本清单**：字体检测、长期未解、离线不可用。**支持我们"第一期只做模板即代码"的决定。**

#### 5.2 `hugohe3/ppt-master`（MIT，74872★）

**导出损坏 / 需要修复（最贴近我们的场景）**
- https://github.com/hugohe3/ppt-master/issues/250 — `[Bug] wsl环境中生成的 PPTX 在 LibreOffice 中无法另存为 .pptx（提示只能用 .odp），在 Microsoft PowerPoint 中无法打开 / 修复失败`

→ **影响**：这就是用户最恨的"打开要我点修复"。根因通常是 **OOXML 部件关系/Content_Types 不合法**。`genoffice` 的做法值得抄：它注入内置版式时是**成套写入** `layout part + rels + [Content_Types] override + slideMaster 的 rels + sldLayoutIdLst`。**我们必须有一个"OOXML 合法性自检"**（zip 部件齐全、每个 r:id 有 rels、Content_Types 有 override），放进 selfCheck 的本地校验器。

**中文 / 字体度量**
- https://github.com/hugohe3/ppt-master/issues/293 — `[Bug] LibreOffice 折行/掉字：全角标点（——、""等）宽度估算偏低，单行文本框被折行（附最小复现）`
- https://github.com/hugohe3/ppt-master/issues/199 — `Native PPTX text wraps/overflows in LibreOffice-rendered PDFs: converter ignores letter-spacing & underestimates serif glyph width`
- https://github.com/hugohe3/ppt-master/issues/192 — `PPTX gets generated with zh-CN locale, which doesn't work well for latin fonts`

→ **影响**：**只要我们自己算文字宽度，就必须处理全角标点与中西混排。** 结论：**不要自己算**——把字数预算做在**生成前**（selfCheck 拦超长），而不是在导出处靠度量兜。这正是我们"标题≤28字/要点≤40字"的价值所在。

**用户自带模板**
- https://github.com/hugohe3/ppt-master/issues/284 — `使用自己的模板制作PPT还是有文字覆盖，排版错位问题`

**流水线分段（正向佐证）**
- https://github.com/hugohe3/ppt-master/issues/173 — `新特性:增加一个大纲文稿的审查和优化环节`（用户主动要求加 outline 审查 = 我们的两段式）
- https://github.com/hugohe3/ppt-master/issues/295 — `Proposal: optional browser-based, slide-by-slide review in Refine Spec`（**逐页 review spec** = 我们的 slideSpec 确认）
- https://github.com/hugohe3/ppt-master/issues/178 — `新特性：增加一个成品预览和风格选择的环节`

→ **影响**：**这三条是"分段 + 可确认"需求真实存在的直接证据**——用户会自己提出来要求。我们的五步方向对。

**结构化输出**
- https://github.com/hugohe3/ppt-master/issues/205 — `schema must be a JSON Schema of 'type: "object"', got 'type: null'`

#### 5.3 `sligter/LandPPT`（Apache-2.0 改写版，3644★）—— 中文场景最贴近，但坑最密

**token 成本（最有价值的两条）**
- https://github.com/sligter/LandPPT/issues/89 — `重新生成页面时把图片丢进文本输入里不科学吧，每次重新生成一页要600K-1000K的token，我都破产了。**Base64编码吓死人**`
- https://github.com/sligter/LandPPT/issues/27 — `一个16 页的 ppt 消耗 20w token 有点多`

→ **影响（必须写进我们的红线）**：**图片绝不以 base64 进文本 prompt**，更不能进"重新生成单页"的上下文。我们的逐页重生成必须只带：`brief` + 该页 `slideSpec` + 版式槽位定义，**图片以 URL/引用传递**，且**不带历史页全文**。这一条能省 100 倍 token。

**导出（商业 SDK 锁死）**
- https://github.com/sligter/LandPPT/issues/57 — `导出pdf和ppt报错，已经配置了Apryse key`
- https://github.com/sligter/LandPPT/issues/58 — `[feat request]是否可以支持 apryse 以外的 pptx 导出方法`
- https://github.com/sligter/LandPPT/issues/19 — `Apryse 没有MacOS的轮子......`
- https://github.com/sligter/LandPPT/issues/43 — `不能导出PPT,导出来的是HTML的压缩包`

→ **影响**：**导出链路里放进一个需付费 key 的第三方 SDK，等于给自己装了一个随时会响的闹钟**（key 配不对就报错、平台支持不全、用户永远在问"能不能换个导出方式"）。**我们从第一天就不引入任何需要 license key 的导出组件。**

**版式错误**
- https://github.com/sligter/LandPPT/issues/63 — `生成的ppt版式错误，页面与页面之间大小不一致，图表还好像渲染或者生成失败`

→ **影响**：版式必须**强约束**（统一 16:9 画布 + 版式自带尺寸），不能允许模型自由决定页面尺寸。这正是我们 layoutAssign 用规则引擎的另一个理由。

**大纲质量 / 结构化**
- https://github.com/sligter/LandPPT/issues/65 — `关于AI生成大纲的疑问，以及大纲生成内容低下的问题`
- https://github.com/sligter/LandPPT/issues/22 — `大纲中有单引号或换行导致 PPT编辑器页面按钮失效`

→ **影响**：`#22` 是**经典注入坑**——大纲里的单引号/换行把前端按钮搞失效（说明他们把那串文本拼进了 HTML/JS 或某个未转义的模板）。**我们必须：所有模型输出先当不可信字符串消毒再进前端；且 JSON 里禁止裸换行**。`#65` 说明"大纲质量"是用户第一感知点，我们"每页标题必须是行动式完整陈述句"的约束就是在治这个。

**可部署性（劝退级）**
- https://github.com/sligter/LandPPT/issues/110 — `源码编译后提示要邀请码`
- https://github.com/sligter/LandPPT/issues/88 — `编辑器部分代码是不公开的吗，我在代码文件里面找不到关于这部分的代码`

→ **影响**：**自部署项目留"邀请码"后门 = 不可私有化**。我们绝不能有任何 license server / 激活码 / 回连校验。

#### 5.4 `genspark-ai/genoffice`（Apache-2.0，11958★）—— 安全最值得拆

**API Key 安全**
- https://github.com/genspark-ai/genoffice/issues/727 — `agent-core: payload redactor misses common secret shapes`
- https://github.com/genspark-ai/genoffice/issues/1677 — `harness: the public-hygiene credential gate in ci.yml is dead code`
- https://github.com/genspark-ai/genoffice/issues/1016 — `shell: AI settings are persisted non-atomically`

→ **影响**：**这是最贴近我们红线的一组实证。** 一个 Apache-2.0、BYOK、自带 redactor 的项目都踩了：
① **redactor 漏形态** —— 说明脱敏是**枚举不完**的，正解不是"过滤已知模式"，而是**白名单**：只允许 `brief/slideSpec` 的已知字段进 prompt，其余一律不透传。
② **CI 里的凭据检查是死代码** —— 说明"我们会检查"这种自证式合规不可靠。要有**真会失败的自动化**（pre-commit 扫描 `sk-`/`AIza`/`xoxb` 等 + bundle 产物扫描）。
③ **设置非原子写** —— Key 落盘半截会损坏，必须原子写（tmp + rename）。
**代码实测补充**：`gh search code` 在 genoffice 里搜 `safeStorage` → **0 命中**，`keytar` → 仅命中无关的 `isGridKeyTarget`。即 **Key 存在普通设置 JSON 里，没接 OS 钥匙串**。我们可以做得比它好（Electron `safeStorage` / 服务端则**永不落盘明文**，只在 session 内存里）。

**BYOK 被供应商锁定**
- https://github.com/genspark-ai/genoffice/issues/1948 — `Slides generator allows initial generation via BYOK (Gemini API Key), but blocks subsequent modifications or second deck generations with Sign in to Genspark`
- https://github.com/genspark-ai/genoffice/issues/25 — `Add an option for BYOK`

→ **影响**：**"BYOK"必须是真的 BYOK**——首轮和后续所有调用（微调、重生成、selfCheck）都要走用户自己的 Key，不能有一个环节回落到厂商云。这是我们会被人拿来对比的点。

#### 5.5 `chuspeeism/dashi-ppt-skill`（AGPL-3.0 ⚠️，10489★）—— **只可读设计**

- https://github.com/chuspeeism/dashi-ppt-skill/issues/15 — `中文字段长度限制过于严苛（未区分中文与英文）`
- https://github.com/chuspeeism/dashi-ppt-skill/issues/16 — `layout 选择缺乏文档 / 可视化预览，用户只能"盲选"`
- https://github.com/chuspeeism/dashi-ppt-skill/issues/17 — `校验器"挤牙膏"——一次只暴露部分错误`
- https://github.com/chuspeeism/dashi-ppt-skill/issues/22 — `导出的PPT文件字体与html预览不一致`
- https://github.com/chuspeeism/dashi-ppt-skill/issues/43 — `开源了个壳子。导出就算了，主题页面也是打包好的不给改吗`

→ **影响**：`#15`/`#17`/`#16` 是**三条可以直接抄进我们 selfCheck 设计规范的产品级教训**（中文双阈值、一次报全错、版式 ID 必须语义化 + 报错时推荐 2–3 个兼容版式）。`#43` 提醒：**AGPL 项目也可能核心闭源**，所以"读设计"是唯一可行的用法，不要指望复用其主题体系。

#### 5.6 `icip-cas/PPTAgent`（MIT，5225★）

- https://github.com/icip-cas/PPTAgent/issues/243 — `反复INSPECTION_FAILED`（**open**）
- https://github.com/icip-cas/PPTAgent/issues/58 — `docker下载下来有25.2G，为什么这么大？`
- https://github.com/icip-cas/PPTAgent/issues/146 — `You should install the customized python-pptx for this project`
- https://github.com/icip-cas/PPTAgent/issues/180 — `如果用了minerU，这个项目的协议也应该是AGPL，而不能是MIT`
- https://github.com/icip-cas/PPTAgent/issues/213 — `本地4090部署DeepPresenter后, 无法完成ppt生成`

→ **影响**：`#243` = **反思环必须有上限**（我们的 selfCheck 重试上限设 2 轮，抄 dashi）；`#58`/`#146`/`#213` = **部署重到不可用**（25.2G 镜像 + 定制 fork 的依赖 + 要 9B 模型）；`#180` = **MIT 不等于干净**，依赖传染要自己查。**结论：PPTAgent 只读论文思路（两阶段 edit-based + 页级功能类型/schema），不做依赖。**

### Q6. 安全：有没有把 apiKey 打到前端 / 写进日志的 issue？

**有，而且是成组的。这是本线最重要的负面证据。**

#### `presenton` —— 一天之内连开 4 条安全 issue（2026-10-03），全部已关闭

- https://github.com/presenton/presenton/issues/972 — `[security]Full unauthenticated access to local APIs`
- https://github.com/presenton/presenton/issues/973 — `[security]Credential database and log download`
- https://github.com/presenton/presenton/issues/974 — `[security]Unauthorized API key read`
- https://github.com/presenton/presenton/issues/975 — `[security]Unauthorized configuration modification to hijack the LLM`

**外加**：
- https://github.com/presenton/presenton/issues/769 — `security: remove committed Presenton MCP API token`（**把 token 提交进了仓库**，后补 PR 删除）

**对本项目影响（正文红线，逐条落成可验收项）：**

| 红线 | 实证依据 | 我们的强制做法 |
|---|---|---|
| **Key 绝不进 bundle** | #974 未授权读取 API key | Key 只存在于**服务端 session**（或 Electron `safeStorage`）；前端 bundle 里**只出现 `hasKey: true/false`**；构建产物加一条 CI 检查：`grep -rE 'sk-[A-Za-z0-9]{20,}\|AIza[0-9A-Za-z_-]{30,}' dist/` 必须零命中 |
| **Key 绝不进 git** | #769 committed token | `.gitignore` + pre-commit hook（`detect-secrets` / 自写正则）。**不靠"我们会注意"**——见 genoffice #1677 的死代码教训 |
| **Key 绝不进日志** | #973 `Credential database and **log** download` | 日志层做**统一脱敏中间件**：任何 `dict` 落日志前，把 key 白名单字段替换成 `***`；**且日志文件本身不可通过任何 API 下载**（#973 的第二半才是真问题——能下载日志就等于能下载一切） |
| **Key 绝不进 prompt** | genoffice #727 redactor 漏形态 | 用**白名单构造 prompt**，不是黑名单过滤。prompt 模板里只插 `brief/outline/slideSpec` 的**结构化字段**，没有任何 `settings` 对象能流进去 |
| **无未认证本地 API** | #972 未认证访问本地 API | 本地服务必须**每次启动生成一次性 token**，绑定 127.0.0.1 + Origin 校验；不接受任意来源。**这条最容易漏，因为我们做的是本地/自部署产品** |
| **无未授权配置改写** | #975 改配置劫持 LLM | 修改 provider/baseURL/apiKey 的接口要**二次确认 + 只允许本会话内**；baseURL 变更必须重填 key（防 SSRF 到攻击者的"OpenAI 兼容"端点偷 key） |
| **导出浏览器不带 CVE** | #1007 48 个 critical CVE | 不在交付物里常驻 Chromium（见 Q3） |

`genoffice` 的对照面（同一形态、Apache-2.0、BYOK）说明**这些坑不是二三线项目才会踩**：它也有 #727 的 redactor 缺陷、#1677 的 CI 凭据门失效、#1016 的非原子写、且**未接 OS 钥匙串**。→ **安全必须做成机制，不能做成习惯。**

---

## 4. 本线结论

### 4.1 抄哪些流程

| # | 抄什么 | 从谁 | 落点 |
|---|---|---|---|
| 1 | **两阶段 BLOCKING 确认**（Stage 1 契约 + Stage 2 完整方案），"只有用户能确认，agent 不代确认、静默不算确认" | `ppt-master` routing/generate-pptx | 我们的"先大纲确认 → 再逐页生成"，外加第三道 spec 复核（可选） |
| 2 | **spec 双产物**：`design_spec`（人读/评审用）+ `spec_lock`（机器执行用的冻结快照），且"lock 与 spec 不一致就阻断" | `ppt-master` | `selfCheck` 的前置：slideSpec 一旦确认就冻结，逐页生成期间不得漂移 |
| 3 | **三段式校验器 + 一次报全错**：结构校验 / 文案预算校验 / 产物校验，**一次吐出全部违规项** | `dashi`（#17 教训） | `src/selfcheck/`：先跑全部规则，聚合后一次性返回 |
| 4 | **文案长度预算分中英文双阈值**（中文按 UTF-8 字符数 × 2 折算） | `dashi` #15 | "标题≤28字/要点≤40字"改为**按字符计 + 中英分档**，并在报错里写明"该字段上限 N，可换这些版式：…" |
| 5 | **版式 ID 语义化 + 报错时推荐候选版式** | `dashi` #16 的反面教训 | `layoutAssign` 输出必须含 `chosenReason` + `rejected[]`，且版式库命名如 `statement-3point` / `comparison-2col` |
| 6 | **最多 2 轮返工，超了标"阻塞"并如实说明**（"不得将其表述为已完成成果"） | `dashi` SKILL.md | `selfCheck` 重试策略上限 |
| 7 | **版式即代码，导出时成套物化进 pptx**（layout part + rels + Content_Types override + slideMaster 注册） | `genoffice` `builtin-layouts.ts` | 我们的 Theme/Layout 三层 → 导出层物化 |
| 8 | **不在用户 .pptx 上原地加结构**，必须先转"校验过的独立 workspace" | `ppt-master` routing.md Hard rule | 二期做"上传母版"时的硬约束 |
| 9 | **页面级降级**：单页失败降级为"标题 + 要点"，不阻断整份 deck | 空白区（presenton #951 的教训反推） | 我们的优势项，写进 stage 设计 |
| 10 | **mock provider**（固定 JSON 返回）供本地开发/自检 | `presenton` / `PPTAgent` offline 模式 | 开发期必备，成本极低 |
| 11 | **OOXML 合法性自检**（zip 部件齐全 / r:id 全有 rels / Content_Types 有 override） | `ppt-master` #250 反推 | selfCheck 的本地校验器必备项，专治"打开要修复" |
| 12 | **两阶段 edit-based + 页级功能类型/内容 schema** 的建模方式 | `PPTAgent` 论文 | slideSpec 的 schema 设计：区分"页的功能类型"与"该类型的槽位集合" |

### 4.2 不抄什么

| ✗ 不抄 | 理由 |
|---|---|
| **让模型自由选版式** | `presenton` #841 已证在中小模型上失效；prompt 修不了确定性问题 |
| **代码** | `dashi` 是 **AGPL-3.0 ⚠️**（知识参考，非依赖）；`tldraw` 禁生产环境 ⚠️；`presenton-export` 无许可证 ⚠️；`LandPPT` 虽然定性为 Apache-2.0 但文本非标准、且编辑器闭源 |
| **一次性吐整份 deck** | `presenton` #951 撞输出 token 上限且无降级 |
| **图片 base64 进 prompt** | `LandPPT` #89 单页 600K–1000K token |
| **LibreOffice 常驻** | `LandPPT`/`PPTAgent` 的部署复杂度（sidecar + 25.2G 镜像）不值得 |
| **Chromium 常驻做导出** | `presenton` #1007 把 48 个 critical CVE 打进交付物；#992/#705 平台差异直接导致导出失败 |
| **商业 SDK（Apryse 类）** | `LandPPT` #57/#58/#19：付费 key、平台不全、用户永远在质疑 |
| **邀请码 / license server / 回连校验** | `LandPPT` #110：源码自编译仍要邀请码 = 不可私有化 |
| **`.pptx` 元素树绝对坐标当版式**（presenton 路线） | 无语义槽位 → 溢出/裁字无解（#940），且 CJK 必然翻车 |
| **反思环无上限** | `PPTAgent` #243 反复 INSPECTION_FAILED |
| **依赖 MinerU 一类 AGPL 组件** | `PPTAgent` #180 的传染质疑 |

### 4.3 要不要 LibreOffice？

**不要。** 6 个候选中只有 2 个（`LandPPT`、`PPTAgent`）强依赖，且这两个恰好是**部署最重、可用性最差**的两个（Apryse 付费锁 + 25.2G 镜像 + 邀请码）。
主流路线（4/6）都是**纯代码写 OOXML**：`genoffice` 自研 TS 引擎、`ppt-master` SVG→DrawingML、`presenton`/`dashi` 用 Chromium 量测 + PptxGenJS。
我们的版式是**代码化固定槽位**，几何在代码里已确定，**不需要"先渲染再看"**，因此连 Chromium 都不需要常驻。
→ 导出层选 **`pptxgenjs`（MIT，6361★）** 或直接写 DrawingML。若要"导出↔预览一致性"检查，用**一次性** headless 渲染跑在 CI，不做运行时依赖。

### 4.4 我们的五步流水线是否成立？

**成立，且相对候选是"更细但有先例"的位置。**

- `brief` → `ppt-master` Stage 1 沟通契约、`dashi` 步骤 1。**有先例。**
- `outline`（行动式完整陈述句标题）→ `PPTAgent` 的 outline、`presenton` 的 outline 端点。**有先例**；"行动式完整陈述句"这个**约束**是我们的差异化，`LandPPT` #65 证明大纲质量是用户第一痛点。
- `slideSpec`（槽位填空 + 字数预算）→ `dashi` 的 PageContentPack + `copyBudgets`、`ppt-master` 的 design_spec + spec_lock、`PPTAgent` 的内容 schema。**三者独立收敛到同一形态，说明这是正确抽象。**
- `layoutAssign`（**规则引擎**）→ **唯一没有成熟先例的一步**。`presenton` #841 是最强的反证（模型选 → 失效）；`dashi` `layout:query` 是最接近的正例（查询而非自由命名），但被 AGPL 锁住且体验差（#16）。
  → **我们的做法是对的，且这件事本身就是我们的技术差异点。只要做到"版式 ID 语义化 + 选择原因可解释 + 报错时推荐替代版式"，就同时避开了 presenton 的失效和 dashi 的盲选。**
- `selfCheck`（模型 + 本地校验器）→ `ppt-master` 的 validate + 双 Gate + visual-review stage、`dashi` 的 3 校验器 + 2 轮上限。**有充分先例**，直接抄工程细节（一次报全错、中文双阈值、返工上限、阻塞语义）。

**建议的一处微调**：把 `selfCheck` 的**本地校验器**前置成"生成前预算校验 + 生成后产物校验"两段。原因：`ppt-master` #293/#199 证明**文字度量不可靠，靠事后测量兜不住**；把字数预算放到生成前拦，是唯一稳的做法。

---

## 5. 未核实项

| 项 | 状态 | 原因 |
|---|---|---|
| `allweonedev/presentation-ai` 的技术细节 | **未核实** | 仅测到 `3074★ / MIT / 2026-06-05T05:57:37Z / TypeScript / 0 open issues`。最后提交已 5 个月，open issues 为 0（疑似关闭 issue 或低活跃），未深挖其导出与模板机制 |
| `presenton` 的 `@presenton/export-core` 具体实现 | **未核实（且不可核实）** | 该包只以 release 产物分发（`presenton/presenton-export`），仓库根目录仅 72 B README，**无源码、无 LICENSE**。无法判定其内部是 PptxGenJS 还是自研 OOXML |
| `LandPPT` 编辑器是否真的闭源 | **未核实** | 只有 [#88](https://github.com/sligter/LandPPT/issues/88) 一条用户提问（正文为空），未见维护者答复原文。仓库有 `frontend/` 目录但我未逐文件核对编辑器实现是否在其中 |
| `LandPPT` 的 `skills/` 目录用途 | 未核实 | 仓库根有 `skills/`（未展开），从命名看是 agent skill，未验证 |
| `tldraw` 的具体版本/包是否已启用 License Key 强制 | **未核实** | 只核实了 LICENSE 全文（明确写有 License Key 校验、环境探测、watermark、使用数据回传），未验证当前 npm 包是否已实施 |
| `genoffice` 的 apiKey 究竟落在哪个文件 | **部分核实** | 代码搜索确认**无 `safeStorage`、无 `keytar`**；有 `ai-settings-guard.ts`（`MAX_API_KEY_LENGTH` 截断）、`credential-env.ts`（支持 `apiKeyEnv` 环境变量引用）、#1016 披露"AI settings persisted non-atomically"。**但未定位到具体的设置文件路径与是否加密** |
| 各项目"是否曾在日志里泄露真实 key"的实例 | **未核实** | `presenton` #973 的标题是 `[security]Credential database and log download`，**我读不到正文**（该 issue 需读 body，本次只核实了标题与状态）。可用于断言"存在日志下载面"，但**不能**断言"确认在日志里泄露了 key 明文" |
| `PPTAgent` 当前的模型依赖（是否必须 DeepPresenter-9B） | **未核实** | #247 提到 `uses_local_model()` 会误启动本地 DeepPresenter-9B；README 有 Atria Dawn Preview 路径。未通读以确认"纯 API 模式是否可行" |
| 各项目的实际用户规模 / 生产使用情况 | **不可得** | GitHub 无此数据；star 不等于使用量 |

---

## 6. 原始命令与输出

> 说明：`pwsh` 里直接调 `pwsh` 报「找不到命令」，`.ps1` 被默认执行策略拦截，故统一用
> `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` 调用。临时脚本全部在 `.research/d-*.ps1`，可复跑。
> **注意**：`.ps1` 内不要写中文注释——Windows PowerShell 5.1 按 ANSI 读无 BOM 文件会把中文注释解析成语法错误（本线实际踩到一次，`d-tree.ps1` 首次运行报 `Unexpected token '}'`）。

### 1) 主候选基础数据（`scripts/gh-probe.ps1` → `gh api repos/OWNER/REPO`）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 `
  presenton/presenton sligter/LandPPT icip-cas/PPTAgent allweonedev/presentation-ai `
  gitbrent/PptxGenJS scanny/python-pptx
```

```
presenton/presenton	11809	Apache-2.0	2026-11-06T05:46:19Z	TypeScript	False	36	2025-05-10T14:12:46Z	Open-Source AI Presentation Generator and API (Gamma, Canva, Beautiful AI, Decktopus, Presentations AI Alternative)
sligter/LandPPT	3644	NOASSERTION	2026-11-08T03:37:27Z	Python	False	4	2025-06-28T10:04:20Z	一个基于LLM的演示文稿生成平台，能够自动将文档内容转换为专业的PPT演示文稿。平台支持多种AI模型，提供丰富的模板和样式选择，让用户能够创建高质量的演示文稿。
icip-cas/PPTAgent	5225	MIT	2026-11-02T22:05:04Z	Python	False	18	2025-01-04T00:54:29Z	An Agentic Framework for Reflective PowerPoint Generation
allweonedev/presentation-ai	3074	MIT	2026-06-05T05:57:37Z	TypeScript	False	0	2025-03-24T10:25:24Z	ALLWEONE® Open source AI presentation generator Gamma Alternative. Create professional slides with customizable themes and AI-generated content in minutes.
gitbrent/PptxGenJS	6361	MIT	2025-11-28T20:17:14Z	TypeScript	False	309	2016-02-23T02:15:29Z	Build PowerPoint presentations with JavaScript. Works with Node, React, web browsers, and more.
scanny/python-pptx	3583	MIT	2024-08-07T17:36:44Z	Python	False	544	2012-11-21T11:03:31Z	Create Open XML PowerPoint documents in Python
```

### 2) Lead 补充的 3 个候选

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\gh-probe.ps1 `
  genspark-ai/genoffice hugohe3/ppt-master chuspeeism/dashi-ppt-skill
```

```
genspark-ai/genoffice	11958	Apache-2.0	2026-11-08T02:35:37Z	TypeScript	False	71	2026-07-31T09:40:58Z	Free, open-source AI Office suite: Docs, Sheets, Slides, PDF, Markdown and HTML editors with a built-in AI agent, plus a `genoffice` CLI and agent skill so Claude Code, Codex and Cursor can create and edit real .docx/.xlsx/.pptx files locally. Bring your own key. macOS, Windows & Linux.
hugohe3/ppt-master	74872	MIT	2026-11-08T10:38:28Z	Python	False	1	2025-12-10T06:54:33Z	AI turns documents or topics into real, native PowerPoint decks—with native shapes, transitions and animations, data-backed charts and tables on demand, audio narration from speaker notes, and support for your own .pptx templates. · by Hugo He
chuspeeism/dashi-ppt-skill	10489	AGPL-3.0	2026-11-06T08:26:30Z	JavaScript	False	16	2026-06-10T07:46:43Z	An AI-agent skill that generates browser-editable presentations from multiple visual themes, exportable to HTML, PDF, and PPTX.
```

### 3) 仓库搜索（补候选池）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-search.ps1
# 内部：gh search repos $q --limit 12 --json fullName,stargazersCount,pushedAt,description
# $q ∈ 'ai presentation generator' / 'ppt generation llm' / 'slides agent' / 'ai powerpoint generator' / 'pptx generation ai'
```

关键命中（按 star 降序，节选）：

```
===== QUERY: ai presentation generator =====
presenton/presenton	11809	2026-11-06T05:46:19Z	Open-Source AI Presentation Generator and API ...
allweonedev/presentation-ai	3074	2026-06-05T05:57:37Z	ALLWEONE® Open source AI presentation generator Gamma Alternative...
Akxan/ppt-agent-skill	181	2026-05-11T00:47:17Z	🎨 World-class AI presentation generator · 26 styles · 18 charts...
Deepnar/presentation-forge	17	2026-11-08T08:47:47Z	Self-hosted AI presentation generator: topic or sources in, researched themed editable PPTX and report out...
===== QUERY: ppt generation llm =====     （0 命中）
===== QUERY: slides agent =====         （最高 27★，无相关项目）
===== QUERY: ai powerpoint generator =====
AIPMAndy/PPTskill	58	2026-10-29T11:38:26Z	AI 生成原生可编辑 PPTX 的 Skill...
===== QUERY: pptx generation ai =====   （0 命中）
```

> 结论：`gh search` 的星标维度已被前文 6 个候选覆盖，无新增值得纳入的高星项目。

### 4) 许可证全文（`gh api repos/OWNER/REPO/license`，落盘 `.research/lic/`）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-license.ps1 `
  presenton/presenton sligter/LandPPT icip-cas/PPTAgent allweonedev/presentation-ai `
  genspark-ai/genoffice hugohe3/ppt-master chuspeeism/dashi-ppt-skill tldraw/tldraw
```

```
presenton/presenton	Apache-2.0	Apache License 2.0	LICENSE	11340	Apache License	.research\lic\presenton__presenton.txt
sligter/LandPPT	NOASSERTION	Other	LICENSE	11574	Apache License	.research\lic\sligter__LandPPT.txt
icip-cas/PPTAgent	MIT	MIT License	LICENSE	1065	MIT License	.research\lic\icip-cas__PPTAgent.txt
allweonedev/presentation-ai	MIT	MIT License	LICENSE	1070	MIT License	.research\lic\allweonedev__presentation-ai.txt
genspark-ai/genoffice	Apache-2.0	Apache License 2.0	LICENSE	11345	Apache License	.research\lic\genspark-ai__genoffice.txt
hugohe3/ppt-master	MIT	MIT License	LICENSE	1069	MIT License	.research\lic\hugohe3__ppt-master.txt
chuspeeism/dashi-ppt-skill	AGPL-3.0	GNU Affero General Public License v3.0	LICENSE	34523	GNU AFFERO GENERAL PUBLIC LICENSE	.research\lic\chuspeeism__dashi-ppt-skill.txt
tldraw/tldraw	NOASSERTION	Other	LICENSE.md	4609	# tldraw license	.research\lic\tldraw__tldraw.txt
```

**LandPPT LICENSE 全文逐行 diff（vs 标准 Apache-2.0）与 copyleft 关键词扫描：**

```powershell
cd .research\lic
Compare-Object (Get-Content presenton__presenton.txt) (Get-Content sligter__LandPPT.txt)
Select-String -Path sligter__LandPPT.txt -Pattern 'GNU|GPL|copyleft|Commons Clause|non-commercial|network use|SaaS|may not sell|commercial' -CaseSensitive:$false
```

```
（diff 节选，=> 仅在 LandPPT / <= 仅在标准 Apache-2.0）
=>       "Licensor" shall mean the copyright owner or entity granting the License.
<=       "Licensor" shall mean the copyright owner or entity authorized by
<=       the copyright owner that is granting the License.
<=       (an example is provided in the Appendix below).
=>       copyright license to use, reproduce, modify, merge, publish,
=>       distribute, sublicense, and/or sell copies of the Work, and to
=>       permit persons to whom the Work is furnished to do so, subject to
<=       copyright license to reproduce, prepare Derivative Works of,
<=       publicly display, publicly perform, sublicense, and distribute the
<=       Work and such Derivative Works in Source or Object form.
=>    9. Accepting Warranty or Additional Support. While redistributing
<=    9. Accepting Warranty or Additional Liability. While redistributing
=>    Copyright [2024] [LandPPT Team]
<=    Copyright 2025 presenton

（行数统计）仅在 LandPPT: 21 行   仅在标准 Apache-2.0: 17 行
（关键词扫描）仅 1 处命中：167 行 "other commercial damages or losses), even if such Contributor"
             —— 属标准免责条款，非附加限制
最终判定：Apache-2.0 的机械改写版，无 GPL/AGPL/copyleft/Commons Clause/非商用限制
```

**genoffice LICENSE vs presenton Apache-2.0：**

```powershell
Compare-Object (Get-Content genspark-ai__genoffice.txt) (Get-Content presenton__presenton.txt)
# 输出：2 行差异（仅版权行）→ genoffice 是逐字标准 Apache-2.0
```

**`presenton/presenton-export`（导出核心）无许可证：**

```powershell
gh api repos/presenton/presenton-export/license
```

```
{"message":"Not Found","documentation_url":"https://docs.github.com/en/rest/licenses/licenses#get-the-license-for-a-repository","status":"404"}
gh: Not Found (HTTP 404)

# 仓库根目录只有一个文件：
===== presenton/presenton-export =====
file	README.md	72

# releases 只有产物，无源码：
{"assets":1,"published":"2026-11-03T00:18:44Z","tag":"v1.0.53"}
{"assets":1,"published":"2026-11-02T23:17:25Z","tag":"v1.0.52"}
{"assets":1,"published":"2026-10-08T10:15:06Z","tag":"v1.0.51"}
```

**tldraw LICENSE 关键条款（全文 71 行，`.research/lic/tldraw__tldraw.txt`）：**

```
# tldraw license
- Not to use the Software in Production Environments.
- Not to disable, change, or interfere with the Software's License Key enforcement.
## Technical enforcement
The Software includes technical measures to verify License Key validity, detect deployment
environments, enforce usage restrictions based on license type, and ensure proper watermark
display. The Software may collect and transmit usage data to tldraw for license compliance purposes.
## Governing law：Delaware
```

### 5) issue 存在性逐个核实（57 个，0 个 404）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-verify-issues.ps1
# 内部：gh api "repos/$repo/issues/$n" → 打印 number/state/comments/created/title
```

```
===== presenton/presenton =====
940	open	comments=0	2026-09-18T17:22:06Z	[Bug]: CJK text is clipped in exported PPTX — template `line_height` < 1.0 makes the line box shorter than the glyphs
904	closed	comments=3	2026-09-03T04:57:20Z	[Bug]: HTML-to-PPTX export differs significantly from preview for Chinese decks on Windows PowerPoint
747	closed	comments=0	2026-07-14T02:45:57Z	PPTX export shows CJK (Chinese/Japanese/Korean) text as garbled on macOS, LibreOffice, Google Slides
951	closed	comments=1	2026-09-21T14:37:27Z	The model reached its output-token limit before producing a complete Smart slide.
748	closed	comments=1	2026-07-14T02:45:59Z	Outline generation fails with "Expecting value" on non-OpenAI providers
841	closed	comments=2	2026-08-18T15:47:26Z	[Bug]: Doesn't Select Title Slide on Some Models
974	closed	comments=3	2026-10-03T13:20:41Z	[security]Unauthorized API key read
973	closed	comments=3	2026-10-03T13:19:43Z	[security]Credential database and log download
972	closed	comments=3	2026-10-03T13:19:02Z	[security]Full unauthenticated access to local APIs
769	closed	comments=0	2026-07-20T11:36:08Z	security: remove committed Presenton MCP API token
1001	closed	comments=0	2026-10-28T00:59:56Z	[Bug]: Error detecting fonts when uploading pptx for template creation
754	closed	comments=9	2026-07-15T12:39:49Z	[Bug]: Creating Own Presentation Templates in Presenton
781	closed	comments=6	2026-07-26T16:41:49Z	Custom templates feature doesn't work offline.
1007	open	comments=1	2026-11-01T21:14:46Z	Docker image pins Chromium 149 (Debian snapshot 2026-06-25): 48 critical CVEs in the export browser
===== sligter/LandPPT =====
27	closed	comments=0	2025-10-22T09:59:56Z	一个16 页的 ppt 消耗 20w token 有点多
89	closed	comments=0	2026-04-23T02:07:37Z	大兄弟，重新生成页面时把图片丢进文本输入里不科学吧，每次重新生成一页要600K-1000K的token，我都破产了。
63	closed	comments=3	2026-02-14T10:51:01Z	生成的ppt版式错误，页面与页面之间大小不一致，图表还好像渲染或者生成失败
43	closed	comments=3	2025-12-24T02:33:38Z	不能导出PPT,导出来的是HTML的压缩包
57	closed	comments=1	2026-01-16T13:51:52Z	导出pdf和ppt报错，已经配置了Apryse key
58	closed	comments=1	2026-01-16T15:37:23Z	[feat request]是否可以支持 apryse 以外的 pptx 导出方法
19	closed	comments=0	2025-09-12T02:25:24Z	Apryse 没有MacOS的轮子......
88	closed	comments=1	2026-04-22T08:02:29Z	你好，关于编辑器部分代码是不公开的吗，我在代码文件里面找不到关于这部分的代码，请问是否有开源这部分代码，谢谢
110	closed	comments=0	2026-06-11T11:42:07Z	源码编译后提示要邀请码
22	closed	comments=1	2025-09-27T06:30:42Z	大纲中有单引号或换行导致 PPT编辑器页面按钮失效
65	closed	comments=2	2026-02-28T11:04:32Z	关于AI生成大纲的疑问，以及大纲生成内容低下的问题
===== icip-cas/PPTAgent =====
243	open	comments=0	2026-05-26T06:11:09Z	反复INSPECTION_FAILED
180	closed	comments=1	2026-01-14T14:50:51Z	如果用了minerU，这个项目的协议也应该是AGPL，而不能是MIT
58	closed	comments=1	2025-03-05T06:45:04Z	docker下载下来有25.2G，为什么这么大？
146	closed	comments=0	2025-09-30T09:23:41Z	You should install the customized `python-pptx` for this project, see https://github.com/Force1ess/python-pptx
247	open	comments=1	2026-07-14T12:34:13Z	uses_local_model() wrongly starts local DeepPresenter-9B when agents point to a localhost OpenAI-compatible gateway
213	closed	comments=6	2026-03-23T03:32:10Z	本地4090部署DeepPresenter后, 无法完成ppt生成
===== hugohe3/ppt-master =====
284	closed	comments=0	2026-09-08T03:19:56Z	使用自己的模板制作PPT还是有文字覆盖，排版错位问题，请教下怎么解决比较好
250	closed	comments=4	2026-08-04T12:45:35Z	[Bug] wsl环境中生成的 PPTX 在 LibreOffice 中无法另存为 .pptx（提示只能用 .odp），在 Microsoft PowerPoint 中无法打开 / 修复失败
293	closed	comments=1	2026-09-16T15:10:42Z	[Bug] LibreOffice 折行/掉字：全角标点（——、“”等）宽度估算偏低，单行文本框被折行（附最小复现）
199	closed	comments=1	2026-06-24T11:07:09Z	Native PPTX text wraps/overflows in LibreOffice-rendered PDFs: converter ignores letter-spacing & underestimates serif glyph width
205	closed	comments=2	2026-06-29T23:01:42Z	用codex+ccswitch使用ppt-master报错schema must be a JSON Schema of 'type: "object"', got 'type: null'.
173	closed	comments=1	2026-06-14T02:57:20Z	新特性:增加一个大纲文稿的审查和优化环节
295	closed	comments=4	2026-09-20T04:26:50Z	Proposal: optional browser-based, slide-by-slide review in Refine Spec
178	closed	comments=2	2026-06-14T16:28:39Z	新特性：增加一个成品预览和风格选择的环节。
===== chuspeeism/dashi-ppt-skill =====
15	closed	comments=1	2026-07-09T17:43:50Z	中文字段长度限制过于严苛（未区分中文与英文）
16	closed	comments=1	2026-07-09T17:44:51Z	layout 选择缺乏文档 / 可视化预览，用户只能"盲选"
17	closed	comments=1	2026-07-09T17:47:03Z	校验器"挤牙膏"——一次只暴露部分错误
22	open	comments=0	2026-07-13T04:03:00Z	导出的PPT文件字体与html预览不一致
43	open	comments=0	2026-09-04T08:21:30Z	开源了个壳子。导出就算了，主题页面也是打包好的不给改吗
7	closed	comments=0	2026-07-08T06:38:40Z	无法直接转出PPTX和PDF
===== genspark-ai/genoffice =====
727	closed	comments=2	2026-09-22T05:15:25Z	agent-core: payload redactor misses common secret shapes
1677	closed	comments=1	2026-09-30T03:37:15Z	harness: the public-hygiene credential gate in ci.yml is dead code
1016	closed	comments=0	2026-09-25T16:26:56Z	shell: AI settings are persisted non-atomically
2449	open	comments=0	2026-11-03T03:06:11Z	Docs: CJK fonts referenced by their localized (Chinese) family name fall back to SimSun, while the English name of the same font works
2390	closed	comments=3	2026-11-01T10:00:02Z	Docs: font dropdown does not apply a CJK font to Chinese text when the font name is not recognized as East Asian (MiSans, LXGW WenKai, AR PL UMing, Noto Sans Mono CJK…)
1948	closed	comments=1	2026-10-11T05:39:29Z	Slides generator allows initial generation via BYOK (Gemini API Key), but blocks subsequent modifications or second deck generations with Sign in to Genspark
25	closed	comments=3	2026-08-05T08:23:31Z	Add an option for BYOK
```

**补测 5 个（第二批核实）：**

```powershell
foreach ($x in @(@('presenton/presenton',705),@('presenton/presenton',800),@('presenton/presenton',845),@('presenton/presenton',992),@('hugohe3/ppt-master',143))) {
  $j = gh api "repos/$($x[0])/issues/$($x[1])" 2>$null; $o = $j | ConvertFrom-Json
  "$($x[0])#$($x[1])`t$($o.state)`t$($o.title)" }
```

```
presenton/presenton#705	closed	[Bug] Export to PDF/PPTX fails in Microsoft Store version (Chromium preparation error)
presenton/presenton#800	closed	[Bug] Gemini via New API ignores json_schema required by structured generation
presenton/presenton#845	closed	[Bug]: Max tokens set to 8192
presenton/presenton#992	open	[Bug]: Windows Store app 0.9.11-beta: PDF and PPTX export fail with spawn EINVAL
hugohe3/ppt-master#143	closed	PPT 中的文字渐变填充效果在 SVG 转换时丢失
```

### 6) 导出路径 / LibreOffice 依赖取证

```powershell
# (a) 全仓代码搜索
gh search code -R icip-cas/PPTAgent libreoffice --limit 10
gh search code -R genspark-ai/genoffice soffice --limit 10
gh search code -R presenton/presenton soffice --limit 10
gh search code -R chuspeeism/dashi-ppt-skill pptxgenjs --limit 8
gh search code -R presenton/presenton python-pptx --limit 8
```

```
=== icip-cas/PPTAgent :: libreoffice ===
icip-cas/PPTAgent:README.md: **Requirements:** ... and LibreOffice available as `libreoffice` on PATH.
icip-cas/PPTAgent:skills/pptagent/scripts/pptagent.py: checks["command:libreoffice"] = shutil.which("libreoffice") is not None
icip-cas/PPTAgent:skills/pptagent/scripts/pptagent_runtime/core.py: "libreoffice",

=== genspark-ai/genoffice :: soffice ===
（全部为注释 / 错误提示 / 测试 fixture，例如）
apps/sheets/native/xlsx-engine/src/convert.rs: /// `soffice --headless --convert-to ods --outdir ...` （仅测试用）
packages/doc2docx/src/errors.ts: 'the document is password-protected; remove the password in Word or LibreOffice before importing it'
→ 无运行时依赖

=== presenton/presenton :: soffice ===
（0 命中）

=== chuspeeism/dashi-ppt-skill :: pptxgenjs ===
skills/dashi-ppt/project/package.json: "pptxgenjs": "^4.0.1",
skills/dashi-ppt/project/packages/html-deck-to-pptx/index.mjs: exportEditablePptxFromPage(page, options)

=== presenton/presenton :: python-pptx ===
servers/fastapi/pyproject.toml: "python-pptx>=1.0.2",
servers/fastapi/templates/pptx_font_utils.py: Replace fonts in a PPTX file using python-pptx.
```

```powershell
# (b) LandPPT 的 LibreOffice sidecar 镜像
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-file.ps1 `
  -Repo sligter/LandPPT scripts/pptx-renderer/Dockerfile
```

```
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress fonts-noto-cjk fonts-liberation fontconfig && rm -rf /var/lib/apt/lists/*
COPY worker.py /worker.py
ENV HOME=/tmp
USER 1000:1000
CMD ["python", "/worker.py"]
```

```powershell
# (c) LandPPT 的编排与商业 SDK
# docker-compose-pptx.yaml → pptx-renderer 服务：
#   read_only: true / cap_drop: [ALL] / network_mode: none / mem_limit: 1g / cpus: 1.0 / pids_limit: 128
#   volumes: pptx_render_spool:/spool   depends_on: pptx-render-init (chown 后 completed_successfully)
# pyproject.toml L73-74：
#   "playwright>=1.40.0",
#   "apryse-sdk>=11.6.0",
```

```powershell
# (d) presenton 导出栈（Chromium + 独立 export-core）
# Dockerfile 关键行：
#   APT: chromium / chromium-common / chromium-driver  （apt-mark hold 锁版本）
#   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
#   RUN node /app/scripts/sync-presentation-export.cjs --force
#   RUN test -f /app/presentation-export/node_modules/@presenton/export-core/dist/index.js
# package.json: "presentationExportVersion": "v1.0.51"
# scripts/sync-presentation-export.cjs:33:
#   "https://github.com/presenton/presenton-export/releases/download"
# 另：镜像内移除所有非 Noto 字体，并预装 fonts-noto-cjk / fonts-noto-cjk-extra（说明其重视 CJK）
```

```powershell
# (e) genoffice 的版式即代码证据
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-file.ps1 `
  -Repo genspark-ai/genoffice packages/pptx-engine/src/builtin-layouts.ts
```

```
/**
 * Built-in standard slide layouts (PowerPoint's core set).
 *
 * AI-generated decks usually ship a single empty layout, leaving the layout
 * picker useless. These definitions mirror the Office default template's
 * placeholder geometry (16:9 base, scaled to the actual slide size) and are
 * injected into the package on first use: layout part + rels + [Content_Types]
 * override + slideMaster registration (rels + sldLayoutIdLst), so the result
 * is a regular layout PowerPoint also understands.
 */
export const BUILTIN_LAYOUTS: BuiltinLayoutDef[] = [
  { key: 'titleSlide', name: 'Title Slide', type: 'title',
    placeholders: [ { type: 'ctrTitle', x: 1524000, ... }, { type: 'subTitle', idx: '1', ... } ] },
  { key: 'titleContent', name: 'Title and Content', type: 'obj', placeholders: [TITLE, BODY] },
  ...
```

**`packages/pptx-engine/src/` 文件规模（证明是自研 OOXML 引擎，不是包一层）：**

```
index.ts 184945   parse.ts 176373   generate.ts 78725   chart.ts 68850   animation.ts 50637
placeholder.ts 32530   insert.ts 28441   native-shape 相关   custgeom.ts 14446   layout.ts 11294
builtin-layouts.ts 9019   master-edit.ts 5125   embedded-fonts.ts 14912   ...
```

### 7) 关键 issue 正文取证（`.research/d-bodies.ps1` → `gh api repos/.../issues/N`）

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-bodies.ps1 -Repo presenton/presenton 841 748 951
```

**#841 正文（决定 Q1 结论的核心证据）：**
```
### Summary
When using Gemma 4 A4B models the title slide are never used.  When I use Mistral it works fine.
### Steps to reproduce
4. Select general template
5. The title slide is not used it uses the next available slide.
### Expected behavior
Title slide should be used as the first slide.
I think the prompt just needs enhancing so it is clearer to the LLM on identifying the title slide.
```

**#748 正文（决定 Q4 结论）：**
```
# Outline generation fails with "Failed to generate presentation outlines. Please try again.
#   Expecting value: line 1 column 1 (char 0)" on non-OpenAI providers that don't fully
#   implement OpenAI Responses / streaming / json_schema semantics
> Affects **every** provider that differs from OpenAI on any of these three
> dimensions: streaming, `json_schema strict`, or `thinking` honouring.
...
| `json_schema strict=true` | Forces pure JSON per schema | Either 400-rejects or ignores, returns prose |
| `thinking={type:"disabled"}` | Suppresses reasoning entirely | API marks `reasoning_tokens=0` but **still writes ``` blocks into `content`** |
Same shape will hit DeepSeek-Moe, Moonshot, Zhipu, Yi, Baichuan, possibly others — anywhere the API cheats on OpenAI fidelity.
...
The error bubbles up from `dirtyjson.loads(presentation_outlines_text)`, but the root cause is upstream
```

**#951 正文（决定 Q3/Q4 结论）：**
```
fastapi.exceptions.HTTPException: 422: The model reached its output-token limit before
producing a complete Smart slide. Increase Max output tokens in Advanced text-provider
settings or reduce the slide count/reasoning effort.
# 调用栈：utils/llm_calls/generate_smart_presentation.py:929 → 整份 deck 一次生成
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-bodies.ps1 -Repo sligter/LandPPT 89
```
**#89 正文（决定 token 红线）：**
```
大兄弟，重新生成单一页面时把图片丢进文本输入里不科学吧，每次重新生成一页要600K-1000K的token，
我都破产了。Base64编码吓死人呀。用了好几天才发现这个问题，晕了。
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-bodies.ps1 -Repo chuspeeism/dashi-ppt-skill 15 16 17
```
**#15 正文节选：**
```
校验器对 `tags`、`lead`、`captions` 等字段有严格的字符数上限（如 tags ≤ 18 字符、lead ≤ 61 字符、
captions ≤ 20 字符）。但这些限制明显是按**英文单词**设计的——英文 18 字符约等于 3 个词，信息量足够；
而中文 18 字符只够写 **9 个字** ...
### 建议
- 区分中英文的字符长度阈值：中文按 **UTF-8 字符数 × 2** 折算，或为中文字段单独设定更大的上限（如 36 字符）
- 或者在错误信息中说明该 field 的最大长度，并提示用户可替换的 layout 列表
```
**#16 正文节选：**
```
当前 layout 以 `theme02_page001`、`theme02_page052` 等编号命名，用户无法从名字判断该 layout 的用途、
字段约束、适合哪种内容类型。导致选 layout → 校验报错（字段超长/不兼容）→ 换 layout 的试错循环 ...
实际经历：为了找到一个能容纳 OpenAI GPT-5.6 介绍的 layout，换了 3 次（page052 → page013 → page049）...
- 更理想：在校验报错时直接推荐 2-3 个兼容当前内容的替代 layout
```
**#17 正文节选：**
```
每次运行 `props:safe` 只报告当前文件中的问题，修完后再次运行才暴露下一批问题 ...
导致需要 4-6 轮迭代才能从 `ok: false` 走到 `ok: true`。
- **一次报告所有冲突**
```

### 8) 其他取证脚本

```powershell
# 仓库根目录清单
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-tree.ps1 presenton/presenton sligter/LandPPT

# 拉取单个/多个文件（base64 解码后落盘 .research/files/）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-file.ps1 `
  -Repo hugohe3/ppt-master skills/ppt-master/workflows/generate-pptx.md skills/ppt-master/requirements.txt
# 目录清单
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-file.ps1 `
  -Repo presenton/presenton templates

# issue 列表（含全部历史）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-issues.ps1 presenton/presenton sligter/LandPPT
# 仓库内关键词搜 issue
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\d-issue-search.ps1 `
  genspark-ai/genoffice "api key" "secret" "log" "libreoffice"
```

**presenton 根目录（关键：`layouts.json` 252637 B，16 套 templates，NOTICE 1.27 MB）：**
```
file	Dockerfile	7256
file	LICENSE	11340
file	NOTICE	1274338
file	docker-compose.yml	26384
file	layouts.json	252637
file	package.json	1246
file	start.js	19755
dir	electron
dir	servers
dir	templates
```
```
===== presenton/presenton :: templates =====
dir	civic / dynamic / editorial / executive / general / horizon / landmark / modern
dir	momentum / mosaic / nova / pulse / signal / standard / swift / verdant     （16 套）
```

**`layouts.json` 结构（绝对坐标元素树，由 `pptx-to-json` 反解自 .pptx）：**
```json
{
  "layouts": {
    "layouts": [
      {
        "id": "business_proposal_cover_layout",
        "description": "Dark business proposal cover with full-bleed building photo, dotted corner overlays, ...",
        "components": [
          { "id": "background_component",
            "position": { "x": 0, "y": 0 }, "size": { "width": 1280, "height": 720 },
            "elements": [
              { "type": "rectangle", "fill": {"color":"#FFFFFF","opacity":1}, ... },
              { "type": "image",
                "data": "http://127.0.0.1:8000/app_data/pptx-to-json/1d2b545f-.../images/image1-16c43050d578.png",
                "fit": "cover", "decorative": true, "name": "architecture_background" }
            ] }
        ]
      }
    ]
  }
}
# 注意：元素是绝对坐标 + description 自然语言，没有语义槽位名 → 无字数预算可挂
```

**LandPPT 根目录（关键：两个 pptx-renderer compose overlay + `template_examples/` + `skills/`）：**
```
file	Dockerfile	7409
file	docker-compose-pptx-renderer.yaml	521
file	docker-compose-pptx.yaml	1161
file	pyproject.toml	3820
dir	frontend
dir	helm
dir	skills
dir	src
dir	template_examples
```
```yaml
# docker-compose-pptx.yaml（overlay，pptx-renderer 段）
  pptx-renderer:
    build: ./scripts/pptx-renderer
    user: "10001:10001"
    network_mode: none
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    mem_limit: 1g
    cpus: 1.0
    pids_limit: 128
    volumes: [ pptx_render_spool:/spool ]
```

**ppt-master 的流水线骨架（`skills/ppt-master/workflows/generate-pptx.md`，46470 B）：**
```
20: ## Cross-Cutting Authorities
30: ## Workflow
32: ### Step 1: Source Content Processing
53: ### Step 2: Project Initialization
72: ### Step 3: Template Candidate Preparation
91: ### Step 4: Strategist Phase (MANDATORY in the default pipeline)
183: ### Step 5: Image Acquisition Phase (Conditional)
212: ## ✅ Planning Session Complete
220: ### Step 6: Executor Phase
320: ### Step 7: Post-processing & Export
366: ### Revision Round (delivered project)
370: ## ✅ Generate PPTX Complete
```
关键段落原文：
```
⛔ **BLOCKING — two-stage confirmation**: the always-on user gate unless explicitly delegated.
Only the user confirms: the agent authors recommendations, operates the server, reads state, and
applies a template. It never confirms on the user's behalf ... silence confirms nothing.
```
```
⛔ **GATE — final state → Design Spec → conditional review → lock**:
Read ${SKILL_DIR}/templates/spec_lock_reference.md; author `spec_lock.md` once from the approved
Design Spec ... Compare lock anchors to the Design Spec and run
`python3 ${SKILL_DIR}/scripts/project_manager.py validate <project_path>`.
Schema validity never proves fidelity: a final-state → Design Spec mismatch, an approved Design Spec
→ lock mismatch, or an unapplied revision blocks.
```
```
267: | `mirror` / `layout` | Start from the complete `page_layouts` SVG and preserve inherited visuals,
     root identity, atoms, and slots. Strict keeps the contract; `layout` may reflow carrier text inside
     unchanged slot bounds; adaptive uses a Strategist-declared Layout.
     A required atom or slot change returns upstream; Executor never edits `spec_lock.md`. |
```
**routing.md 的硬规矩（值得直接抄）：**
```
**Hard rule — no direct structure grafting or automatic upgrade**: an existing PPTX or SVG is never
upgraded in place by adding Master/Layout/placeholder structure — run `create-template` for a separate
validated workspace, then pass its root to Default Stage 1 ... and author new structured pages.
```

**ppt-master 依赖清单关键行（证明不需要 LibreOffice，但 PyMuPDF 是 AGPL）：**
```
# Most tools use only the Python standard library. Below are optional dependencies.
PyYAML>=6.0
python-pptx>=0.6.21
XlsxWriter>=3.0.0
skia-pathops>=0.9.2
uharfbuzz>=0.50.0
# License notice: PyMuPDF is AGPL-3.0 (commercial license available from Artifex).
# It is imported only by pdf_to_md.py; skip this line if you never convert PDF sources,
# and review the AGPL terms before redistributing a bundle that includes it.
PyMuPDF>=1.23.0
```
（**无任何 LibreOffice / soffice / office 套件依赖**）

**dashi-ppt SKILL.md 关键段（`layout:query` + `copyBudgets` + 返工上限）：**
```
## 页面角色
`role` 只用于草稿选页，最终 JSON 的前三个方案必须落成具体 `layout` ...
## 页面属性契约
- `copyKeys`: 可安全改写的文案/数据字段。
- `copyBudgets`: 文案长度预算;`display` / `metric` 超长会被 goal spec 拦截。
- `mediaSlots`: 图片/视频写入字段、count key、默认数量和最大数量。
## 校验
- 渲染前必须运行 `validate:goal-spec`。
- 输出后必须运行 `validate:swiss`。
- 输出后必须运行 `validate:goal-copy`。
## 成果验收与返工
默认最多修正 2 轮。验收通过后才能交付;两轮后仍不通过则标记"阻塞",说明未达标项和阻塞原因,
不得将其表述为已完成成果。
发现任一不合格项就标记"待修正": ... 页面信息角色或容量不匹配时重新 `layout:query` 并更换 layout
```

**PPTAgent 论文摘要（两阶段 edit-based 的出处）：**
```
"Existing methods primarily focus on improving and evaluating the content quality in isolation,
overlooking visual appeal and structural coherence ... we propose PPTAgent, which comprehensively
improves presentation generation through a two-stage, edit-based approach inspired by human workflows.
PPTAgent first analyzes reference presentations to extract slide-level functional types and content
schemas, then drafts an outline and iteratively generates editing actions based on selected reference
slides to create new slides."
```

**dashi 导出栈（HTML → Playwright + pptxgenjs，证明不需要 LibreOffice）：**
```
skills/dashi-ppt/scripts/render_goal_deck.ps1:
  # 镜像模式下 playwright 浏览器二进制同样走 npmmirror,否则国内下载必败。
  $env:PLAYWRIGHT_DOWNLOAD_HOST = 'https://cdn.npmmirror.com/binaries/playwright'
skills/dashi-ppt/project/packages/html-deck-to-pptx/index.mjs:
  //   exportEditablePptxFromUrl(browser, url, options)   // 给一个 Playwright browser + deck URL → 可编辑 .pptx
  //   exportEditablePptxFromPage(page, options)          // 给一个已打开的 Playwright page
skills/dashi-ppt/project/package.json: "pptxgenjs": "^4.0.1"
```

**genoffice 无 OS 钥匙串（代码搜索）：**
```powershell
gh search code -R genspark-ai/genoffice "safeStorage"   # → 0 命中
gh search code -R genspark-ai/genoffice "keytar"        # → 仅 isGridKeyTarget 等无关命中
gh search code -R genspark-ai/genoffice "apiKey"        # → 命中 packages/ai-provider/* 与 apps/*/src/main/*
#   packages/ai-provider/src/credential-env.ts: 支持 profile 的 `apiKeyEnv`（从环境变量取值）
#   packages/ai-provider/src/ai-settings-guard.ts: apiKey: String(raw.apiKey ?? '').slice(0, MAX_API_KEY_LENGTH)
#   → Key 存普通设置对象，无 OS 钥匙串加密；结合 #1016「persisted non-atomically」
```

---

## 附录：本次落盘的证据文件

| 路径 | 内容 |
|---|---|
| `.research/d-search.ps1` | 候选池搜索 |
| `.research/d-license.ps1` | LICENSE 全文拉取与解码 |
| `.research/d-tree.ps1` | 仓库根/子目录清单 |
| `.research/d-file.ps1` | 单文件/目录拉取（base64 解码） |
| `.research/d-issues.ps1` | issue 列表批量拉取 |
| `.research/d-issue-search.ps1` | 仓库内关键词搜 issue |
| `.research/d-verify-issues.ps1` | 55 个 issue 编号存在性核实 |
| `.research/d-bodies.ps1` | 关键 issue 正文取证 |
| `.research/lic/*.txt` | 8 份 LICENSE 全文（含 LandPPT、tldraw） |
| `.research/files/**` | 拉取的 Dockerfile / pyproject / requirements / SKILL.md / workflows 等 |
| `.research/issues/*.json` | presenton / LandPPT / genoffice / ppt-master / dashi / PPTAgent 的 issue 列表快照 |
| `.research/issue-bodies/*.txt` | 本次引用的关键 issue 正文原文 |

> 复跑方式：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\<脚本>.ps1 <参数>`
