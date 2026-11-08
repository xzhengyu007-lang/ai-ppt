/**
 * LLM 提供方 —— 只认 OpenAI 兼容协议，三字段可配。
 *
 * 安全红线（任务书「密钥四不入」）：
 *  - Key 只从服务端 env 读，**不进前端 bundle**；
 *  - 不写日志（本文件任何日志都只打 provider/model/延迟，不打 key）；
 *  - 不进 prompt；
 *  - 不进 git（.env 已在 .gitignore）。
 *
 * 无 Key 时自动进入 mock：不联网、CI 可跑。
 */
import { z } from "zod";
import { readEnv, readEnvNum } from "@/lib/runtime/env";

export interface LlmConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

export function getConfig(): LlmConfig {
  // 走 readEnv：浏览器（纯静态构建）里没有 process，直接读会炸
  return {
    provider: readEnv("LLM_PROVIDER") ?? "mock",
    baseUrl: (readEnv("LLM_BASE_URL") ?? "").replace(/\/$/, ""),
    apiKey: readEnv("LLM_API_KEY") ?? "",
    model: readEnv("LLM_MODEL") ?? "",
    maxTokens: readEnvNum("LLM_MAX_TOKENS", 60000),
    timeoutMs: readEnvNum("LLM_TIMEOUT_MS", 120000),
  };
}

/** 没有 Key 或显式 mock 就走离线模式 */
export function isMockMode(cfg: LlmConfig = getConfig()): boolean {
  if (cfg.provider === "mock") return true;
  return !cfg.apiKey || !cfg.baseUrl || !cfg.model;
}

/** 只暴露给前端的"可公开"配置，绝不含 key */
export function publicConfig() {
  const cfg = getConfig();
  return {
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    mock: isMockMode(cfg),
    hasKey: Boolean(cfg.apiKey),
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class LlmError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

async function postChat(
  cfg: LlmConfig,
  messages: ChatMessage[],
  jsonMode: boolean
): Promise<{ text: string; usage: TokenUsage }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.4,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // 注意：不要在这里打印请求头或 body，避免 key 泄漏进日志
      const brief = (await res.text()).slice(0, 300);
      throw new LlmError(`模型接口返回 ${res.status}：${brief}`, res.status);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };
    return { text, usage };
  } catch (e) {
    if (e instanceof LlmError) throw e;
    const msg = (e as Error).name === "AbortError" ? "请求超时" : (e as Error).message;
    throw new LlmError(`调用模型失败：${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}

/**
 * 要求模型返回结构化 JSON，并用 zod 校验。
 * 失败带错误信息回灌重试，最多 2 次；仍失败抛错，由调用方降级（绝不静默出空页）。
 */
export async function chatJson<T>(
  schema: z.ZodType<T>,
  opts: {
    system: string;
    user: string;
    maxRetries?: number;
    onUsage?: (u: TokenUsage) => void;
  }
): Promise<T> {
  const cfg = getConfig();
  const maxRetries = opts.maxRetries ?? 2;
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { text, usage } = await postChat(cfg, messages, true);
    opts.onUsage?.(usage);

    try {
      const parsed = JSON.parse(extractJson(text));
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = `JSON 解析失败：${(e as Error).message}`;
    }

    // 回灌具体错误，让模型自己修
    messages.push({ role: "assistant", content: text.slice(0, 2000) });
    messages.push({
      role: "user",
      content: `上面的输出不符合要求：${lastError}\n请只输出修正后的 JSON 对象，不要任何解释。`,
    });
  }

  throw new LlmError(`结构化输出连续 ${maxRetries + 1} 次不合法：${lastError}`);
}

/** 设置页的「连通性测试」 */
export async function testConnection(): Promise<{
  ok: boolean;
  mock: boolean;
  model: string;
  latencyMs: number;
  message: string;
}> {
  const cfg = getConfig();
  if (isMockMode(cfg)) {
    return {
      ok: true,
      mock: true,
      model: "mock",
      latencyMs: 0,
      message: "未配置 Key，当前为 mock 模式（本地 fixture，不联网）",
    };
  }
  const started = Date.now();
  try {
    const { text } = await postChat(
      cfg,
      [{ role: "user", content: "只回复两个字：可用" }],
      false
    );
    return {
      ok: true,
      mock: false,
      model: cfg.model,
      latencyMs: Date.now() - started,
      message: `连通正常，返回：${text.slice(0, 40) || "(空)"}`,
    };
  } catch (e) {
    return {
      ok: false,
      mock: false,
      model: cfg.model,
      latencyMs: Date.now() - started,
      message: (e as Error).message,
    };
  }
}
