# F 线：导出 spike 2.0 —— 版本 A/B 实测与图表缺陷判决

> 执行时间 2026-11-09。目的：在铺 12 套模板之前，把选型报告 §2.1 里"G0 待 A/B 实测确认"和 §6 R1（图表风险）这两个不确定性拍死。
> 方法：**同一份输入**（`build.mjs`，6 页：封面/要点/柱图/折线/表格/组合图，含 697 字中文备注）分别喂给两个版本，然后跑三套判据。

## 0. 结论（先看这个）

| 判据 | `pptxgenjs@4.0.1` | `pptxgenjs-plus@4.3.6` | `plus` + 后处理 |
|---|---|---|---|
| OOXML 语义体检 | **9 PASS / 4 FAIL** | 13 PASS / 1 FAIL | **14 PASS / 0 FAIL** |
| python-pptx 读回 | 14 / 14 | 14 / 14 | 14 / 14 |
| 图表轴引用（#1534） | ❌ **3 个图表全坏** | ✅ 全部正确 | ✅ |
| Content_Types 幽灵 slideMaster（#1444） | ❌ 5 个幽灵条目 | ✅ 无 | ✅ |
| notesMaster 占位符（#1443） | ✅ 6 个 | ❌ **0 个（退化）** | ✅ 6 个（后处理补回） |

**判决：默认版本定为 `pptxgenjs-plus`，但必须叠一层出口后处理补 notesMaster。`4.0.1` 不作为默认。**
「出口后处理层」这条策略因此从"设计意图"升级为**已验证可用**。

---

## 1. 版本 A/B 的硬证据

### 1.1 图表轴引用：#1534 在 4.0.1 上是**全量**复现，不是偶发

同一份 deck 生成的三个图表部件，逐个人工核对（`inspect-chart.mjs`）：

```
########## 4.0.1 ##########
--- ppt/charts/chart1.xml ---            (柱图)
  c:barChart[0]  axId: 2094734554,2094734552,2094734556
  c:catAx[0]     axId: 2094734554
  c:valAx[0]     axId: 2094734552
--- ppt/charts/chart2.xml ---            (折线)
  c:lineChart[0] axId: 2094734554,2094734552,2094734556
  c:catAx[0]     axId: 2094734554
  c:valAx[0]     axId: 2094734552
--- ppt/charts/chart3.xml ---            (组合图)
  c:barChart[0]  axId: 2094734554,2094734552,2094734556
  c:lineChart[0] axId: 2094734554,2094734552,2094734556
  c:catAx[0]     axId: 2094734554
  c:valAx[0]     axId: 2094734552

########## plus 4.3.6 ##########
--- ppt/charts/chart1.xml ---
  c:barChart[0]  axId: 2094734554,2094734552
  c:catAx[0]     axId: 2094734554
  c:valAx[0]     axId: 2094734552
--- ppt/charts/chart2.xml ---
  c:lineChart[0] axId: 2094734554,2094734552
--- ppt/charts/chart3.xml ---
  c:barChart[0]  axId: 2094734554,2094734552
  c:lineChart[0] axId: 2094734554,2094734552
  c:catAx[0]     axId: 2094734554
  c:valAx[0]     axId: 2094734552
```

`4.0.1` 每个图组都引用 **3** 个轴，但只定义 **2** 个 → 孤儿 `2094734556`。这与 issue #1534 标题完全一致（"`addChart()` writes an orphan `<c:axId>` for BAR/LINE charts — triggers repair dialog"）。
**注意它连最简单的单系列柱图都中招**，不是只有组合图。`plus` 修好了：引用与定义严格 2:2。

### 1.2 Content_Types 幽灵 slideMaster：#1444 也复现

- `4.0.1`：压缩包里只有 `ppt/slideMasters/slideMaster1.xml`，但 `[Content_Types].xml` 声明了 **slideMaster2..6** 五个 Override → 5 个幽灵条目（30 个 Override 中 5 个指向不存在的部件）。
- `plus`：26 个 Override，全部指向真实部件。

### 1.3 但 plus 引入了两个回归

1. **notesMaster 退化**：`4.0.1` 的 notesMaster 是 7504 字节、含 6 个 `<p:ph>` 占位符（hdr/ftr/sldNum/sldImg/body）；`plus` 的只有 **1113 字节、spTree 为空、0 个占位符**。
   - 实测影响范围：**备注文本本身没丢** —— python-pptx 读回两版都是 697 个汉字、逐页可读。丢的是 notesMaster 的结构，会影响 PowerPoint 备注页的呈现/打印，属于 #1443 那一类隐患。
2. OOXML 部件数从 49 变成 50，画布尺寸、rels 全部正常。

### 1.4 后处理层验证：补回 notesMaster 后全绿

`fix-notesmaster.mjs` 把合规的 notesMaster 写回 plus 产物：

```
FIXED out-plus-fixed.pptx
  notesMaster: 1113 B -> 7504 B, 占位符 6 个
```

重新体检：**14 PASS / 0 FAIL**（幽灵条目、轴引用、非法字符、rels、画布尺寸、notesMaster 占位符全过）。

**这就是阶段 2 `src/renderer/pptx/postprocess.ts` 的原型**：库负责大部分、我们负责它做错的那一小块，且这一小块是**可测的**。

---

## 2. 三套判据的分工（阶段 2 要照这个建 CI）

| 判据 | 是什么 | 能抓什么 | 抓不到什么 |
|---|---|---|---|
| **① OOXML 语义体检**（`lint.mjs`） | 不看渲染，直接查包结构与已知缺陷模式 | 幽灵部件、断链 rels、缺 Content-Type、非法控制字符、**孤儿 axId**、**dLblPos 与图型不匹配**、notesMaster 占位符 | 视觉是否正确、字体是否被替换 |
| **② python-pptx 读回**（`readback_check.py`） | 用独立实现打开并枚举 | 能否打开、页数、文本块、几何 EMU↔px、备注、字体名 | 它比 PowerPoint **宽容**，打不开才会报 |
| **③ 真机双开**（人工） | PowerPoint + WPS 各开一次截图 | 「需要修复」弹窗、字体替换、视觉溢出 | 无法自动化（见 §3） |

①和②已经全部脚本化、exit code 可进 CI；③只能人工，这是诚实的边界。

---

## 3. 真机自动化：确认不可用（如实记录）

三次尝试，全部失败，**不是我们代码的问题，是本机 Office 的 COM 状态问题**：

| 尝试 | 结果 |
|---|---|
| v1：设 `Visible` 后 `Open` | 首调 `RPC_E_CALL_REJECTED (0x80010001)`，加重试后卡在模态框，留僵尸进程 |
| v2：跳过 `Visible`，`DisplayAlerts=1` | `DisplayAlerts` 被拒；`Presentations` 返回 **null** |
| v3：全程重试 + 空值容错（25×1.2s，共 ~30s） | `$app.Presentations` **持续 25 次返回 null**，耗尽重试 |

判断：本机 `POWERPNT.EXE`（Office16）疑似未激活或处于受限模式，COM 门面对象建得出来、但集合属性恒为 null。
**处置**：真机验收改为**人工**——阶段 2 交付时双击打开 + 截图存 `docs/evidence/`，符合任务书 4.2 第 4 项的原意（本来就是"各开一次，截图"）。每次尝试后都已清理 `POWERPNT` 残留进程（当前 0 个）。

---

## 4. 对选型报告的修订

| 报告位置 | 原文 | 修订为 |
|---|---|---|
| §2.1 G0 | "`pptxgenjs-plus@4.3.x` … **待 A/B 实测确认**" | **A/B 已做（本文档 §1），plus 4.3.6 判定为默认版本**；4.0.1 的图表与幽灵 slideMaster 缺陷为**全量复现**，不予采用 |
| §2.1 | 三级方案 G1 = 回退 4.0.1 | G1 保留但**降级**：4.0.1 只在"plus 彻底不可用"时考虑，且**必须**同时套后处理修图表与幽灵条目——否则数据页大概率触发修复弹窗 |
| §6 R1 图表风险 | "高：PptxGenJS 4.x 图表 XML 有 bug" | **降为"中"**：`plus 4.3.6` 实测已修 #1534（轴引用正确）；**原生图表可以进一期**。残余风险：① dLblPos(#1546) 本样本未触发但它不是唯一触发条件，仍需真机确认；② plus 自身只有 19★、单人维护 |
| §6 R3 | plus 单人维护 | 保持；新增验证手段——我们的 `lint.mjs` 能**独立**发现这类回归（本次就是它抓出 notesMaster 退化） |
| §0 A10 依赖 | 新增运行时依赖 1 个 | 不变（仍是 pptxgenjs-plus 一个），但**必须**配套 ~1 个后处理模块（自写，非依赖） |

---

## 5. 未核实项

1. **真机是否真不弹修复**：受 §3 限制，未能用 PowerPoint/WPS 实证。当前依据是"schema 级缺陷已清零"，属强证据但非最终证据。
2. **#1546（组合图 dLblPos 串到 line）**：本次 6 页样本里 `plus` 的组合图**未出现** `dLblPos` 非法取值；但这只证明本样本没触发，不等于该 bug 已修。
3. **`plus` 的 notesMaster 退化是否有意为之**（比如为绕开 #1443）未考证；不论动机，我们的后处理都要补回。
4. **gzip 体积**仍未实测（4.0.1 dist raw 264.7 KB；plus 未测）。
5. 本次只测了**单系列**柱/折线与**双系列**组合图；多系列、饼图、双轴未覆盖。

## 6. 复现命令

```powershell
cd .research\spike2
node render.mjs pptxgenjs      out-401.pptx
node render.mjs pptxgenjs-plus out-plus.pptx
node lint.mjs out-401.pptx            # 9 PASS / 4 FAIL
node lint.mjs out-plus.pptx           # 13 PASS / 1 FAIL
node fix-notesmaster.mjs out-plus.pptx out-401.pptx out-plus-fixed.pptx
node lint.mjs out-plus-fixed.pptx     # 14 PASS / 0 FAIL
node inspect-chart.mjs out-401.pptx   # 人工核对轴引用
$env:PYTHONPATH = (Resolve-Path ..\pylib).Path
python ..\readback_check.py out-plus-fixed.pptx   # 14 PASS / 0 FAIL
```

相关脚本：`build.mjs`（共同输入）、`render.mjs`（双版本渲染）、`lint.mjs`（语义体检）、`inspect-chart.mjs`、`inspect-part.mjs`、`fix-notesmaster.mjs`（后处理原型）、`ppt-verify.ps1`（真机自动化，三次失败）。
