# B 线调研：pptx 读回校验与 OOXML 包结构体检

> 调研日期 2026-11-09（墙钟时间，不是 2025）。全部数字来自本次会话真实执行的 `gh api` / PyPI JSON API / 本机实跑。
> 说明：本线的原 owner（teammate）中途失败退出，**由 Lead 接手完成**，数据全部重新实测，不继承任何未验证结论。

## 0. 一句话结论

**读回校验用 `python-pptx` 1.0.2（锁版本、离线 wheel 随仓库存档），包结构体检自己写（60 行），不引入 Open-XML-SDK / POI / LibreOffice。**
`python-pptx` 上游已停更（27 个月），但它在这里是**CI 工具链依赖**而非产品运行时依赖，且已实测能完成全部读回断言 —— 停更风险可接受，处置见 §4。

---

## 1. 候选实测表（8 列）

| 仓库 | stars | license | 最近提交 | 语言 | 能拿到什么 | 迁移到本项目要改哪几个文件 | 坑 |
|---|---|---|---|---|---|---|---|
| **`scanny/python-pptx`** | 3583 | MIT | default branch HEAD `278b47b1` @ **2024-08-06**；`pushed_at` 2024-08-07；**PyPI 最新 1.0.2 @ 2024-08-07** | Python | 完整的 OOXML 读+写：`Presentation()` 打开、slides 枚举、text frame/paragraph/run 读取、`left/top/width/height` 返回 `Emu`、`notes_slide.notes_text_frame`、图片 shape、表格、图表占位。**已实测可用**（见 §3） | `scripts/validate_pptx.py` 一个文件；不进前端 bundle、不进服务端运行时 | **已 27 个月无提交**（触发 6 个月铁律）；544 open issue 且**新 issue 零回应**（#1156 2026-11-05 提出，0 评论）；只读校验足够，但**不能指望它修 bug** |
| **`dotnet/Open-XML-SDK`** | 4619 | MIT | HEAD `431ab05c` @ 2026-08-18；release v3.5.1 @ 2026-03-18 | C# | 微软官方 OOXML SDK，含 **`OpenXmlValidator`（真正的 schema 校验器）**；这是候选里唯一"官方的合法性判定" | 需引 .NET 运行时 + 一个 CLI 包装（`scripts/validate` 调 dotnet），CI 要装 .NET SDK | 给我们的技术栈加一整套 .NET 运行时，为的只是"校验"这一件事，性价比低；且它的 validator 自身有误报（#2128） |
| **`iOfficeAI/OfficeCLI`** | 33140 | Apache-2.0 | HEAD `c56512c8` @ 2026-10-30；release **v1.0.160 @ 2026-10-30（9 个 asset，多平台二进制）** | C# | **单二进制、无需装 Office**，能读/改/自动化 pptx/docx/xlsx；**自带 `validate` 子命令**与**pptx→HTML 预览**；活跃发版（1.0.158/159/160 三周一版） | 作为**第二意见校验器**：CI 里 `officecli validate out.pptx` 与 python-pptx 断言并行，一个文件都读不出来就 fail | 太年轻（created 2026-03-15）；**它自己的 validate 有漏判**（#602：`.rels`/`[Content_Types].xml` 仍引用的部件缺失却校验通过）→ 不能单独当门禁 |
| **`apache/poi`**（XSLF） | 2285 | `NOASSERTION`（gh 未识别；常理为 Apache-2.0，**未由 API 佐证**） | `pushed_at` 2026-11-07 | Java | 最完整且仍维护的 OOXML 实现（XSLF 处理 pptx） | 要引 JVM 服务，与"浏览器一键导出"架构无关，纯负担 | 在本项目栈里没有位置；仅作"确实有人用 Java 干这事"的对照 |

**对照：不引入 LibreOffice。** 本机实测 `soffice` 不存在、`docker` 不在 PATH（详见 `.research/lead-环境实测.md`），而交付验收要求的"PowerPoint + WPS 打开无修复提示"在本机**有真 PowerPoint（Office16）和真 WPS**，可以人工裁决，不需要 LibreOffice 转 PDF 这条替代链。

---

## 2. 每个主干 ≥2 个真实 issue（均 `gh issue list` 实测存在）

### 2.1 `scanny/python-pptx`

| issue | 状态 / 日期 / 评论 | 对本项目的含义 |
|---|---|---|
| [#1135](https://github.com/scanny/python-pptx/issues/1135) DX trap: `paragraph.font.size` writes `defRPr`, causing PowerPoint UI font-size bounce-back | OPEN / 2026-06-07 / **0** | 字号读写有陷阱。我们**只读不写**（生成交给 PptxGenJS），所以不受影响 —— 这正是"读回校验"与"用 python-pptx 生成"的关键区别 |
| [#1156](https://github.com/scanny/python-pptx/issues/1156) FreeformBuilder produces wildly distorted shapes due to coordinate/scale handling | OPEN / 2026-11-05 / **0** | 坐标/缩放处理有 bug。我们只用它**读** `left/top/width/height`（已实测精确回读，见 §3），不走 FreeformBuilder |
| [#1142](https://github.com/scanny/python-pptx/issues/1142) `add_picture` silently corrupts `blip r:embed` after save when source slide was modified via XML swap | OPEN / 2026-07-10 / 0 | 写侧会产出坏文件，进一步确认"它只配当读回工具，不配当生成器" |
| [#1137](https://github.com/scanny/python-pptx/issues/1137) **[Security]** Path Traversal / Zip Slip in `PackURI` and `_DirPkgReader` / `_ZipPkgWriter` | OPEN / 2026-06-16 / 0 | **安全边界**：校验脚本只处理**我们自己生成**的文件，绝不能让它去解析用户上传的 .pptx。二期做"上传母版"时必须先沙箱化 |

### 2.2 `iOfficeAI/OfficeCLI`（第二意见校验器候选）

| issue | 状态 / 日期 / 评论 | 对本项目的含义 |
|---|---|---|
| [#602](https://github.com/iOfficeAI/OfficeCLI/issues/602) validate: a part that `.rels` and `[Content_Types].xml` still reference is missing, yet validation passes | OPEN / 2026-11-02 / 0 | **它的 `validate` 会漏判**——恰恰漏的是我们最关心的一类（关系指向不存在的部件）。所以它只能当"第二意见"，不能当唯一门禁 |
| [#607](https://github.com/iOfficeAI/OfficeCLI/issues/607) pptx: `set placeholder[dt]` reuses the layout shape id on the slide | OPEN / 2026-11-02 / 0 | 占位符 id 复用问题。我们不生成占位符（用绝对坐标文本框），不受影响，但说明其 pptx 写侧仍不稳 |
| [#605](https://github.com/iOfficeAI/OfficeCLI/issues/605) chart: a text column in `dataRange` becomes a zero series without a warning | OPEN / 2026-11-02 / 0 | 图表数据静默降级。与 A 线"PptxGenJS 图表 XML 有 bug"叠加，进一步说明**图表是整条链上最脆弱的一环**，必须有自己的断言 |

### 2.3 `dotnet/Open-XML-SDK`

| issue | 状态 / 日期 / 评论 | 对本项目的含义 |
|---|---|---|
| [#2128](https://github.com/dotnet/Open-XML-SDK/issues/2128) `OpenXmlValidator` rejects a valid `CT_Filters` holding both `filter` and `dateGroupItem` | OPEN / 2026-08-01 / 0 | 官方校验器也有误报（false positive）。**没有任何单一校验器可以当唯一真理**，结论见 §4 |
| [#2091](https://github.com/dotnet/Open-XML-SDK/issues/2091) `WordprocessingDocument.Open` returns null MainDocumentPart when `[Content_Types].xml` omits `Default Extension="rels"` | OPEN / 2026-06-02 / 0 | 正是"包结构缺件 → 打开异常"的典型，佐证我们自己写包结构体检是必要且低成本的 |

---

## 3. 实测：读回链路已跑通（这是本线最硬的证据）

不是"应该能行"，是**已经跑通**。完整闭环：

1. **生成侧**：`pptxgenjs@4.0.1` 生成 `spike-out.pptx`（16:9 13.333×7.5in，中文 `fontFace`、3 条要点、原生柱图、130 字备注）。
   - 包结构断言 **23/23 PASS**（`[Content_Types].xml`、slide→notes/chart rels、`sldSz=12192000×6858000`、`px*9525` 严格换算、无 `.fntdata` 内嵌字体、22 个 XML 部件零非法控制字符、中文以 UTF-8 原样落盘）。
2. **读回侧**：`python-pptx 1.0.2` 独立打开同一文件，**9/9 PASS**：

```
PASS  python-pptx 成功打开文件
PASS  页数枚举  -> 1 页
PASS  画布 = 12192000x6858000 EMU (13.333x7.5in)  -> 实测 12192000x6858000
PASS  文本块可枚举  -> 4 个非空段落
PASS  形状几何可枚举  -> 3 个带坐标的形状
PASS  EMU->px 回读为整数（无累积漂移）  -> 样例 Text 0 x=80.000 y=56.000
PASS  第 1 页备注可读（中文 130 字）
PASS  备注总计  -> 130 个汉字
PASS  字体名可回读（证明字体只存名、未嵌入）  -> Microsoft YaHei
合计：PASS 9 / FAIL 0   (exit code 0)
```

**关键点**：生成器写的 `x=80px`，读回侧还原出 `x=80.000px`，误差 0。这说明"DOM 预览与 pptx 逐元素比对 `x/y/w/h`、误差 ≤2px"这条验收标准，在**坐标层是同构的、可达的**——`1px = 9525 EMU` 精确无误差。剩余误差只会来自**文本行盒与换行**，那部分必须进 `docs/已知差异.md`。

### 3.1 EMU 换算（写进代码的唯一常量）

```
1 inch  = 914400 EMU
96 px   = 1 inch            (画布口径 1280×720 px @96dpi)
1 px    = 914400 / 96 = 9525 EMU
1280 px = 12192000 EMU ； 720 px = 6858000 EMU
```

python-pptx 的 `shape.left` 等属性返回 `Emu`，转 px 用 `Emu(v).inches * 96`；**不要**手写 `/914400*96` 以外的魔法数。

### 3.2 离线安装已验证（无外网 CI 的可行路径）

`pip install` 在本会话沙箱内失败（`pip` 解包要写临时目录，被拒 `Errno 13`）。改为**直接取 wheel 并解压**，这条路已跑通：

```
OK   python-pptx 1.0.2      -> python_pptx-1.0.2-py3-none-any.whl (461 KB)
OK   lxml 6.1.3             -> lxml-6.1.3-cp313-cp313-win_amd64.whl (3910 KB)
OK   Pillow 13.0.0          -> pillow-13.0.0-cp313-cp313-win_amd64.whl (7114 KB)
OK   XlsxWriter 3.3.1       -> xlsxwriter-3.3.1-py3-none-any.whl (176 KB)
OK   typing_extensions 4.16.0 -> typing_extensions-4.16.0-py3-none-any.whl (44 KB)
```

依赖树与 PyPI 元数据一致：`requires_dist = [Pillow, XlsxWriter, lxml, typing-extensions]`，`requires_python >=3.8`，**总计约 11.7 MB**。
→ CI 方案：这 5 个 wheel 直接**随仓库存档**（`scripts/vendor/wheels/`），CI 用 `--no-index --find-links` 安装，**完全不依赖外网**。这是对项目硬要求"无 Key 也能跑、CI 不依赖外网"的直接满足。

---

## 4. 本线结论

### 4.1 用什么

| 用途 | 选择 | 理由 |
|---|---|---|
| **读回校验（CI 门禁）** | `python-pptx==1.0.2` + 自写断言 | 已实测 9/9 通过；纯 Python、MIT、离线可装、exit code 可进 CI |
| **包结构体检** | **自己写**（`zipfile` + `xml.etree`，约 60 行） | 见 4.3；第三方库反而没有针对性 |
| **第二意见（可选）** | `OfficeCLI validate` | Apache-2.0 单二进制、跨平台，能独立发现"关系缺失"类问题；但自身有漏判（#602），只作并行冗余 |
| **LibreOffice** | **不用** | 本机没有；真机 PowerPoint + WPS 已在，验收链完整 |
| **Open-XML-SDK / POI** | 不用 | 为"校验"引 .NET / JVM 运行时，性价比不成立 |

### 4.2 停更否决项怎么处置

`python-pptx` 触发了"最近 6 个月无提交"的一票否决（27 个月）。**处置而非无视**：

1. **角色隔离**：它是 **CI 工具链**依赖，不进 `package.json`、不进前端 bundle、不进产品运行时。产品坏了叫"产品缺陷"，校验脚本坏了只叫"门禁失效"。
2. **锁版本 + 存档**：`python-pptx==1.0.2` 精确锁定，5 个 wheel 存进仓库，**上游即使消失也不影响我们**。
3. **风险兜底**：它只被用来"读"，API 面极小（`Presentation` / `slides` / `shapes` / `text_frame` / `notes_slide` / `Emu`）。真需要修补时，fork 后自己维护的成本在**百行级**，不构成架构风险。
4. **诚实声明**：若将来要做"上传用户 .pptx 当母版"（二期），必须处理 #1137 的 Zip Slip —— 用户上传文件**不得**直接喂给它，要先过解压沙箱与包结构白名单。

### 4.3 包结构体检为什么自己写

第三方校验器**各自都有漏判或误判**：OfficeCLI `validate` 漏"部件缺失"（#602），Open-XML-SDK `OpenXmlValidator` 有误报（#2128），PptxGenJS 自己就是坏件来源之一。

而我们要查的东西非常具体、非常少，`zipfile` + `xml.etree` 60 行全搞定，且**每一条都可以写成 CI 断言**：

| # | 断言 | 为什么必须有 |
|---|---|---|
| 1 | `[Content_Types].xml` 存在且能被 XML 解析 | 缺了直接"需要修复" |
| 2 | 每个 `<Override PartName>` 指向的部件真实存在 | PptxGenJS #1444 就是幽灵 slideMaster 条目 |
| 3 | 每个 `ppt/**/_rels/*.rels` 里的 `Target` 都能解析到真实部件 | OfficeCLI #602 漏的正是这一类 |
| 4 | 每个部件都有 Content-Type（Default 或 Override） | 否则 PowerPoint 拒绝 |
| 5 | 所有 XML 部件扫描 XML 1.0 非法控制字符 `[\x00-\x08\x0B\x0C\x0E-\x1F]` | 备注/正文含这些字符 = "需要修复" |
| 6 | `ppt/presentation.xml` 的 `sldSz` 等于 12192000×6858000 | 画布口径不能漂 |
| 7 | slide 数与 IR 的 slides 数一致 | 防静默丢页 |
| 8 | 无 `.fntdata` 内嵌字体 | 确认"只存字体名"这个前提成立 |

**第 5 条已在本次 spike 实测跑过**（22 个 XML 部件，0 处非法字符），JS 版实现见 `.research/spike/verify.mjs`；Phase 2 会移植为 Python 并并入 `scripts/validate_pptx.py`。

---

## 5. 未核实项

1. **OfficeCLI 的 Windows 二进制在本机未跑过**：仅核实 release v1.0.160 有 9 个 asset，未下载执行；其"无需装 Office 即可 validate"是 README 自述。
2. **`apache/poi` 的 license 未由 API 佐证**：`gh api` 返回 `NOASSERTION`，Apache-2.0 属常识但未实测确认（本线不采用它，故不阻塞）。
3. **python-pptx 对"修复提示"的判定能力未验证**：它能打开不代表 PowerPoint 不会提示修复（它比 PowerPoint **宽容**）。因此读回校验**不能替代**真机验收，只能作为 CI 的快速门禁。
4. **PyPI 只有 win_amd64 的 lxml/Pillow wheel 被实测下载**：Linux/macOS 的 wheel tag 未验证，若 CI 跑 Linux 需另测（纯 Python 包 python-pptx/XlsxWriter/typing_extensions 无此问题）。
5. **未测大文件表现**：本次只校验了 1 页 70 KB 的文件，10 页带图的实际耗时未测。

## 6. 原始命令与输出

见 `.research/b-probe.ps1`（仓库探针 + issue 列表）、`.research/pypi-probe.py`（PyPI 元数据）、`.research/fetch_wheels.py`（离线 wheel）、`.research/readback_check.py`（读回断言）、`.research/spike/verify.mjs`（包结构断言）。关键输出已内联在 §3。

```powershell
# 仓库与 issue（注意 -File 只绑定第一个位置参数，一次一个仓库）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.research\b-probe.ps1 scanny/python-pptx
python .research\pypi-probe.py
python .research\fetch_wheels.py .research\pylib
$env:PYTHONPATH = (Resolve-Path .research\pylib).Path
python .research\readback_check.py .research\spike\spike-out.pptx
```
