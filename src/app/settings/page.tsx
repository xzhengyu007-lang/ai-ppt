"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Palette, RefreshCw, Type, X } from "lucide-react";
import { Card, SectionLabel, Spinner, StatusPill, cx } from "@/components/ui";
import { FONT_WHITELIST, ALLOWED_FONT_NAMES } from "@/lib/ir/constants";
import {
  fetchConnectivity,
  testConnectivity,
  isStaticBuild,
  type ConnectivityInfo,
  type ConnectivityTest,
} from "@/lib/runtime/client";

type Cfg = ConnectivityInfo;

interface TestResult extends ConnectivityTest {}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [fonts, setFonts] = useState<{ name: string; ok: boolean }[]>([]);

  useEffect(() => {
    fetchConnectivity()
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  useEffect(() => {
    const check = () => {
      setFonts(
        ALLOWED_FONT_NAMES.map((name) => ({
          name,
          ok: document.fonts.check(`16px "${name}"`),
        }))
      );
    };
    if (document.fonts?.ready) document.fonts.ready.then(check);
    else check();
  }, []);

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await testConnectivity());
    } catch (e) {
      setResult({ ok: false, mock: false, model: "-", latencyMs: 0, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const missing = fonts.filter((f) => !f.ok);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">设置</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Key 只存在服务端（.env），不会进入前端 bundle、日志或 prompt。
        </p>
        {isStaticBuild() && (
          <div className="mt-3 rounded-control border border-[rgb(214_214_255)] bg-[rgb(var(--brand-soft))] px-3 py-2.5 text-[12px] text-[rgb(var(--brand-strong))]">
            当前是**静态演示版**（GitHub Pages）：没有服务器，固定走本地 fixture，草稿保存在你自己的浏览器里。
            要接真实模型，请自托管或部署到 Vercel —— Key 绝不能进浏览器，这是设计红线。
          </div>
        )}
      </div>

      {/* 模型 */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Cpu size={15} className="text-brand-strong" />
          <span className="panel-title">模型配置（BYOK）</span>
          <div className="ml-auto">
            {cfg ? (
              cfg.mock ? (
                <StatusPill tone="neutral">mock 模式 · 不联网</StatusPill>
              ) : (
                <StatusPill tone="ok">已配置真实 Key</StatusPill>
              )
            ) : (
              <StatusPill tone="neutral">读取中…</StatusPill>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Field label="Provider" value={cfg?.provider ?? "-"} />
          <Field label="Model" value={cfg?.model || "(未配置)"} />
          <Field label="Base URL" value={cfg?.baseUrl || "(未配置)"} span />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={runTest} disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : <RefreshCw size={13} />}
            {busy ? "测试中…" : "连通性测试"}
          </button>
          {result && (
            <div
              className={cx(
                "flex items-center gap-2 rounded-control px-3 py-2 text-[12.5px] border",
                result.ok
                  ? "bg-[rgb(236_253_245)] border-[rgb(204_245_224)] text-[rgb(var(--ok))]"
                  : "bg-[rgb(254_242_242)] border-[rgb(250_210_210)] text-[rgb(var(--danger))]"
              )}
            >
              {result.ok ? <Check size={13} /> : <X size={13} />}
              <span>{result.message}</span>
              {result.latencyMs > 0 && (
                <span className="font-mono text-[11px] opacity-70">{result.latencyMs} ms</span>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-[11.5px] text-faint leading-relaxed">
          改配置：复制 <code className="px-1 rounded bg-sunken font-mono">.env.example</code> 为{" "}
          <code className="px-1 rounded bg-sunken font-mono">.env</code>，填{" "}
          <code className="px-1 rounded bg-sunken font-mono">LLM_BASE_URL</code> /{" "}
          <code className="px-1 rounded bg-sunken font-mono">LLM_API_KEY</code> /{" "}
          <code className="px-1 rounded bg-sunken font-mono">LLM_MODEL</code>，重启 dev 服务生效。
          不填 Key 就是 mock 模式，功能完全可用。
        </p>
      </Card>

      {/* 字体 */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Type size={15} className="text-brand-strong" />
          <span className="panel-title">字体缺失检测</span>
          <div className="ml-auto">
            {missing.length === 0 ? (
              <StatusPill tone="ok">白名单字体全部可用</StatusPill>
            ) : (
              <StatusPill tone="warn">{missing.length} 个缺失</StatusPill>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted leading-relaxed">
          pptx 只记录字体名、不嵌入字体。目标机器没有该字体时会被替换 → 行高变化 → 溢出。
          所以主题只允许白名单字体。
        </p>

        <div className="mt-3.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fonts.map((f) => (
            <div
              key={f.name}
              className={cx(
                "flex items-center gap-2 rounded-control border px-2.5 py-2",
                f.ok ? "border-line bg-card" : "border-[rgb(250_230_180)] bg-[rgb(255_250_235)]"
              )}
            >
              <span
                className={cx(
                  "grid place-items-center w-4 h-4 rounded-full",
                  f.ok ? "bg-[rgb(236_253_245)] text-[rgb(var(--ok))]" : "bg-[rgb(254_243_199)] text-[rgb(var(--warn))]"
                )}
              >
                {f.ok ? <Check size={10} /> : <X size={10} />}
              </span>
              <span className="font-mono text-[11.5px] text-strong truncate">{f.name}</span>
              <span
                className="ml-auto text-[15px] leading-none text-body shrink-0"
                style={{ fontFamily: `"${f.name}", sans-serif` }}
                title="用该字体渲染的样张"
              >
                Aa 中
              </span>
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="mt-3 rounded-control border border-[rgb(250_230_180)] bg-[rgb(255_250_235)] px-3 py-2.5 text-[12px] text-[rgb(var(--warn))]">
            本机缺少 {missing.map((m) => m.name).join("、")}。导出的 pptx 在别人机器上可能因字体替换而溢出，
            生成时会给出告警。建议改用已安装字体。
          </div>
        )}
      </Card>

      {/* 白名单 */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-brand-strong" />
          <span className="panel-title">字体白名单</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["中文主选", FONT_WHITELIST.yahei, "Windows 装机率接近 100%"],
            ["中文备选", FONT_WHITELIST.dengxian, "Windows 自带"],
            ["跨平台 / webfont", FONT_WHITELIST.notoSC, "OFL，= 思源黑体族"],
            ["兜底", FONT_WHITELIST.simsun, "字形老，仅后备"],
            ["西文", FONT_WHITELIST.latin, "通用"],
            ["等宽数字", FONT_WHITELIST.mono, "KPI / 表格"],
          ].map(([role, name, note]) => (
            <div key={name} className="rounded-control border border-line bg-card px-2.5 py-2">
              <SectionLabel>{role}</SectionLabel>
              <div className="mt-1 font-mono text-[11.5px] text-strong">{name}</div>
              <div className="mt-0.5 text-[10.5px] text-faint">{note}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-faint">
          苹方（PingFang）仅 macOS 提供，不会被用作唯一选项 —— 否则 Windows 用户打开就是替换字体。
        </p>
      </Card>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={cx("rounded-control border border-line bg-sunken/60 px-3 py-2", span && "sm:col-span-2")}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1 font-mono text-[12px] text-strong truncate">{value}</div>
    </div>
  );
}
