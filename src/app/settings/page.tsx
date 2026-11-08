"use client";

import { useEffect, useState } from "react";
import { FONT_WHITELIST, ALLOWED_FONT_NAMES } from "@/lib/ir/constants";

interface Cfg {
  provider: string;
  baseUrl: string;
  model: string;
  mock: boolean;
  hasKey: boolean;
}

interface TestResult {
  ok: boolean;
  mock: boolean;
  model: string;
  latencyMs: number;
  message: string;
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [fonts, setFonts] = useState<{ name: string; ok: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/connectivity")
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  // 字体缺失检测：只查白名单，报告"本机有没有"
  useEffect(() => {
    const check = () => {
      const rows = ALLOWED_FONT_NAMES.map((name) => ({
        name,
        // document.fonts.check 对系统字体也有效；16px 是为了让检测稳定
        ok: document.fonts.check(`16px "${name}"`),
      }));
      setFonts(rows);
    };
    if (document.fonts?.ready) document.fonts.ready.then(check);
    else check();
  }, []);

  async function runTest() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/connectivity", { method: "POST" });
      setResult(await res.json());
    } catch (e) {
      setResult({
        ok: false,
        mock: false,
        model: "-",
        latencyMs: 0,
        message: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  const missing = fonts.filter((f) => !f.ok);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8 space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-ink-500">
          Key 只存在服务端（.env），不会进入前端 bundle、日志或 prompt。
        </p>
      </div>

      {/* 模型配置 */}
      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-semibold">模型配置（BYOK）</h2>
        <div className="mt-3 grid gap-2 text-sm">
          <Row label="Provider" value={cfg?.provider ?? "-"} />
          <Row label="Base URL" value={cfg?.baseUrl || "(未配置)"} />
          <Row label="Model" value={cfg?.model || "(未配置)"} />
          <Row
            label="状态"
            value={cfg?.mock ? "mock 模式（本地 fixture，不联网）" : "已配置真实 Key"}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runTest}
            disabled={busy}
            className="h-9 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "测试中…" : "连通性测试"}
          </button>
          {result && (
            <span className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}>
              {result.ok ? "✓" : "✗"} {result.message}
              {result.latencyMs > 0 && `（${result.latencyMs} ms）`}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-300">
          改配置请复制 <code className="rounded bg-ink-100 px-1">.env.example</code> 为{" "}
          <code className="rounded bg-ink-100 px-1">.env</code> 后填写 LLM_BASE_URL / LLM_API_KEY /
          LLM_MODEL，重启 dev 服务生效。
        </p>
      </section>

      {/* 字体检测 */}
      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-semibold">字体缺失检测</h2>
        <p className="mt-1 text-xs text-ink-500">
          pptx 只记录字体名、不嵌入字体。目标机器没有该字体时会被替换 → 行高变化 → 溢出。
          所以只允许白名单字体。
        </p>
        <ul className="mt-3 grid gap-1.5 text-sm">
          {fonts.map((f) => (
            <li key={f.name} className="flex items-center gap-2">
              <span className={f.ok ? "text-green-600" : "text-red-600"}>{f.ok ? "✓" : "✗"}</span>
              <span className="font-mono text-xs">{f.name}</span>
              {!f.ok && <span className="text-xs text-red-600">本机缺失，导出会告警</span>}
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            本机缺少 {missing.length} 个白名单字体。导出的 pptx 在别人的机器上可能因字体替换而溢出，
            生成时会给出告警。建议改用已安装的字体，或安装缺失字体。
          </div>
        )}
      </section>

      {/* 白名单说明 */}
      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-semibold">字体白名单</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-700 md:grid-cols-3">
          <div>中文主选：{FONT_WHITELIST.yahei}</div>
          <div>中文备选：{FONT_WHITELIST.dengxian}</div>
          <div>跨平台：{FONT_WHITELIST.notoSC}（OFL）</div>
          <div>兜底：{FONT_WHITELIST.simsun}</div>
          <div>西文：{FONT_WHITELIST.latin}</div>
          <div>等宽数字：{FONT_WHITELIST.mono}</div>
        </div>
        <p className="mt-3 text-xs text-ink-300">
          苹方（PingFang）仅 macOS 提供，不会被用作唯一选项。
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-xs text-ink-300">{label}</span>
      <span className="font-mono text-xs text-ink-900">{value}</span>
    </div>
  );
}
