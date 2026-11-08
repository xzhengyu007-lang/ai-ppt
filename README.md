# AI PPT 生成网站

**在线访问（永久地址，无需任何 Key）：** <https://xzhengyu007-lang.github.io/ai-ppt/>
**源码仓库：** <https://github.com/xzhengyu007-lang/ai-ppt>

输入主题或大纲 → 选模板 → 调大模型（用户自带 Key）→ 生成整套幻灯片 → 浏览器实时预览并可微调 → **一键导出可编辑的 .pptx**。

预览与导出读的是**同一份 Slide IR**。导出的 pptx 里文字是可编辑的文本、图表是可编辑的原生图表，不是截图。

> 线上那个是**静态演示版**：全部逻辑跑在浏览器里（mock 流水线 + localStorage 存草稿 + 浏览器端导出 pptx），
> 所以没有服务器、没有 Key、也不会有隐私外泄。要接真实模型请看下面「部署与分享」。

---

## 部署与分享

### 方式一 · GitHub Pages（已配好，永久在线）

推送 `main` 就会自动构建并发布静态演示版：

- 地址：<https://xzhengyu007-lang.github.io/ai-ppt/>
- 工作流：`.github/workflows/deploy-pages.yml`（安装 → 跑测试 → `node scripts/build-static.mjs` → 发布 `out/`）

**静态版的能力边界**：生成走浏览器内的 mock 流水线、草稿存 `localStorage`、导出 pptx/PNG 在浏览器完成。
**没有真实模型** —— 这不是省事，而是「密钥四不入」红线的必然结果：静态站没有服务端，Key 无处可藏。

### 方式二 · Vercel（要接真实模型就用这个）

1. Vercel → New Project → 导入该仓库；
2. 框架自动识别 Next.js，填环境变量 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`；
3. **把 `DATABASE_PATH` 设成 `/tmp/app.db`**：serverless 只有 `/tmp` 可写，且实例重启后草稿会丢。

要持久化就换 Postgres/Turso 等托管库（改 `src/lib/storage/decks.ts` 一层即可）。导出 pptx 不受影响——它始终在浏览器端生成。

### 方式三 · 本地跑 + 临时公网地址（演示用）

```bash
pnpm build && pnpm start          # 生产模式，localhost:3000

# 另一个终端：免账号公网隧道（临时，进程关掉即失效）
cloudflared tunnel --url http://localhost:3000
```

⚠️ 本应用**没有鉴权**。公网暴露期间任何人可创建草稿、消耗你的模型额度；演示完请立刻停掉。

### 两种部署怎么共用一套代码

页面不直接调 `/api/*`，而是走 `src/lib/runtime/client.ts` 这一层：
服务端模式转发到 API 路由，静态模式（`NEXT_PUBLIC_STATIC=1`）改为在浏览器内执行同一套流水线。

---

## 快速开始

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

**不需要任何 Key 也能走完整流程**（mock 模式：本地 fixture，不联网）。
要接真实模型：

```bash
cp .env.example .env
# 填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（任何 OpenAI 兼容接口）
pnpm dev
```

### 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发服务器 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动 |
| `pnpm test` | 37 个测试（含几何一致性、导出正确性门禁、API 集成） |
| `pnpm eval` | 20 个主题 × 8 项自动质检，产出 `docs/评测报告.md` |
| `pnpm schema` | 导出 Slide IR 的 JSON Schema 到 `docs/slide-ir.schema.json` |
| `pnpm validate <file.pptx>` | 导出正确性校验（包结构 12 项 + python-pptx 读回 6 项） |

> `python scripts/validate_pptx.py` 的 A 段只用标准库，**CI 不需要装 python-pptx**；装了则自动多跑 B 段读回断言。

---

## 架构

```
┌───────────────────────────────────────────────────────────────┐
│  浏览器                                                        │
│                                                               │
│   主题输入 ──► /api/generate (SSE) ──► 五步流水线               │
│                                          │                    │
│   ┌──────────────────────────────────────▼─────────────────┐  │
│   │           Slide IR  (JSON, zod 校验)                    │  │
│   │   meta + theme tokens + slides[{layout, slots, notes}]  │  │
│   └───────────┬──────────────────────────┬─────────────────┘  │
│               │  resolveSlide()          │                    │
│               ▼                          ▼                    │
│      ┌────────────────┐          ┌──────────────────────┐     │
│      │ ResolvedSlide  │          │ ResolvedSlide        │     │
│      │  DOM 渲染器     │          │  Pptx 渲染器          │     │
│      │  (预览/编辑)    │          │  (pptxgenjs → EMU)   │     │
│      └────────────────┘          └──────────┬───────────┘     │
│                                             ▼                 │
│                                  ┌──────────────────────┐     │
│                                  │ 后处理：补 notesMaster │     │
│                                  │ 清非法字符 + 重打包压缩 │     │
│                                  └──────────┬───────────┘     │
│                                             ▼                 │
│                                    可编辑 .pptx 下载           │
└───────────────────────────────────────────────────────────────┘
                              │
                    服务端只做两件事：
                    ① LLM 代理（Key 不出服务端）
                    ② SQLite 草稿读写
```

**关键设计**
- **单一事实源**：两个渲染器都只消费 `ResolvedSlide`，谁也不许自己算坐标/字号。
- **预折行**：文本在 IR 层就切成行，两个渲染器按行渲染 → 行数与行位置一致（见 `docs/02-渲染与导出一致性.md`）。
- **不依赖渲染器自动缩放**：导出不传 `fit`，溢出由 IR 层估算器负责，算错就**可见地溢出**而不是被偷偷缩小。
- **规则引擎选版式**：`brief → outline → slideSpec → layoutAssign(规则) → selfCheck`，模型不参与版式选择。

---

## 页面

| 路由 | 内容 |
|---|---|
| `/` | 主题输入 + 12 套模板墙（真实渲染缩略图）+ 最近作品 |
| `/editor/[id]` | 左页序 / 中 16:9 画布（等比缩放、全屏）/ 右属性（版式、主题、内容、备注、单页重生成） |
| `/templates` | 12 套主题 × 8 个版式实样 |
| `/settings` | 模型配置 + 连通性测试 + 字体缺失检测 |

编辑能力：文本编辑、换版式、换主题、页序拖动、单页重生成、备注编辑、撤销/重做（快照式）、自动保存（debounce 1.5s）、导出 pptx / 本页 PNG。
**不做**：Canva 级自由画布、多用户协作、在线分享、计费、.pptx 反向导入。

---

## 加一套模板

只需要新增一个 token 对象，**不改任何版式代码**：

```ts
// src/lib/theme/themes.ts
{
  id: "my-brand", name: "我的品牌", description: "…", tone: "light",
  tokens: {
    colors: { primary: "1A2B4C", /* …共 11 个 */ },
    fonts:  { zh: "Microsoft YaHei", en: "Arial", mono: "Consolas" },
    rhythm: { unit: 8, sectionGap: 32 },
    radius: 6,
    border: { width: 1, color: "DCE0E8" },
    lineHeight: { title: 1.2, body: 1.5 },
  },
}
```

跑 `pnpm test` 即自动把新主题纳入「主题 × 8 版式」的全量渲染断言。
**只改一个 token 换配色**：把 `colors.primary` 换成另一个色值，版式几何不变、不破版。详见 `docs/01-模板规范.md`。

---

## 已知限制（不隐瞒）

1. **真机验收未自动化**：本机 PowerPoint COM 在本机不可用（`Presentations` 恒为 null，属 Office 激活/受限问题），"PowerPoint 与 WPS 打开无修复提示"这一条需要**人工截图**，步骤见 `docs/02-渲染与导出一致性.md §6`。当前证据链止于：包结构 12 项断言全过 + python-pptx 读回 6 项全过 + 几何误差 0px。
2. **预览与导出不是像素级一致**：元素框几何一致（≤2px，实测 0px），**文本行盒、避头尾、图表外观存在已知差异**，全部列在 `docs/已知差异.md`。
3. **字体只存名字不嵌入**，目标机器缺字体会回退 → 溢出。已做白名单 + 检测 + 告警，但无法根治。
4. **图表**：导出是原生可编辑图表，但外观与预览的简版图表不同；已知上游 pptxgenjs 家族在图表 XML 上有过坏件 bug，已用 lint 断言守住。
5. **依赖少但偏门**：导出引擎用 `pptxgenjs-plus`（4.0.1 的活跃分支，19★/单人维护），已 vendor 思路 + 单点 adapter + 后处理兜底；退出路径写在 `docs/research/F-导出spike2-版本A-B实测.md`。
6. **SQLite 用 Node 24 内置 `node:sqlite`**（任务书默认 Drizzle）。原因：`better-sqlite3` 需本地编译工具链，与"CI 不依赖外网/构建工具"冲突；SQL 全部收在 `src/lib/storage/decks.ts` 一层，要换 Drizzle 只改这一层。
7. **无 Docker 交付**：本机无 Docker，`docker compose up` 未验证，故不提供。

---

## 交付物索引

| 文件 | 内容 |
|---|---|
| `docs/00-选型报告.md` | 阶段 0：五条线实测（A–F）+ 否决项裁决 + 模块映射表 + 开工假设 |
| `docs/01-模板规范.md` | 三层模型、12 套主题、8 个版式几何、字数预算、加模板步骤 |
| `docs/02-渲染与导出一致性.md` | 单一事实源、预折行、EMU 换算、四项校验 |
| `docs/已知差异.md` | 预览 vs 导出的全部已知差异（D1–D9） |
| `docs/评测报告.md` | 20 主题 × 8 项自动质检结果（`pnpm eval` 生成） |
| `docs/03-素材来源.csv` | 素材与依赖许可证登记（无登记不许合并） |
| `docs/slide-ir.schema.json` | Slide IR 的 JSON Schema（`pnpm schema` 生成） |
| `docs/examples/*.pptx` | 3 份成品：商务汇报 / 学术答辩 / 产品发布 |
| `docs/evidence/browser-export.pptx` | 浏览器真实导出的产物（18/18 校验通过） |
| `docs/research/*.md` | 五条线 + spike 的完整调研证据（含原始命令与输出） |

## 技术栈

Next.js 15.5.29（App Router）· React 19 · TypeScript 5.9 · Tailwind 3.4 · zustand 5 · zod 4 · `node:sqlite` · pptxgenjs-plus 4.3.6 · jszip 3.10

## 许可证与素材红线

- 不抓取任何商业模板站（稻壳/优品/千图/包图/Slidesgo/Canva 等）的模板、图片、图标、字体；
- 图片默认不使用（`image` 槽位是纯图形占位），AI 生图默认关闭；
- 图标 Lucide（ISC），字体 OFL / 系统字体（只写字体名）；
- AGPL 项目（PPTist、dashi）**只读设计、一行代码未拷**；tldraw 为自定义许可明禁生产环境，已否决；
- 每一份外部素材登记在 `docs/03-素材来源.csv`。
