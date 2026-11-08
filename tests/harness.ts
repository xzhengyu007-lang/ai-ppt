/**
 * 极简测试骨架（vitest 风格的 API 子集），**完全进程内运行**。
 *
 * 为什么自己写：本机沙箱禁止 spawn 子进程，vitest（走 rolldown 探测 UNC）和
 * node --test（每个文件 fork 一个子进程）都会直接 EPERM。而这个项目要求
 * "文本不溢出要有测试"，测试跑不起来 = 没有证据，所以自带一个不 fork 的运行器。
 *
 * 只实现用到的断言，保持可读、可调试。
 */

type Fn = () => void | Promise<void>;

interface Case {
  name: string;
  fn: Fn;
  suite: string[];
}

const suites: string[] = [];
const cases: Case[] = [];
let beforeAllHooks: Fn[] = [];

export function describe(name: string, fn: () => void): void {
  suites.push(name);
  try {
    fn();
  } finally {
    suites.pop();
  }
}

export function it(name: string, fn: Fn): void {
  cases.push({ name, fn, suite: [...suites] });
}

export const test = it;

export function beforeAll(fn: Fn): void {
  beforeAllHooks.push(fn);
}

/* ------------------------------------------------------------------ 断言 */

class AssertionError extends Error {}

function fail(msg: string): never {
  throw new AssertionError(msg);
}

function fmt(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

class Expectation {
  // 注意：Node 的 strip-only 模式不支持 TS 参数属性（constructor(private x)），只能显式声明
  private readonly actual: unknown;
  private readonly negated: boolean;
  private readonly msg?: string;

  constructor(actual: unknown, negated: boolean, msg?: string) {
    this.actual = actual;
    this.negated = negated;
    this.msg = msg;
  }

  private check(cond: boolean, description: string): void {
    const ok = this.negated ? !cond : cond;
    if (!ok) {
      const prefix = this.negated ? "期望不满足：" : "期望不满足：";
      fail(`${prefix}${description}. ${this.msg ? `[${this.msg}] ` : ""}实际=${fmt(this.actual)}`);
    }
  }

  get not(): Expectation {
    return new Expectation(this.actual, !this.negated, this.msg);
  }

  toBe(expected: unknown): void {
    this.check(Object.is(this.actual, expected), `应等于 ${fmt(expected)}`);
  }

  toEqual(expected: unknown): void {
    this.check(deepEqual(this.actual, expected), `应深等于 ${fmt(expected)}`);
  }

  toBeTruthy(): void {
    this.check(Boolean(this.actual), "应为真值");
  }

  toBeFalsy(): void {
    this.check(!this.actual, "应为假值");
  }

  toBeCloseTo(expected: number, digits = 2): void {
    const a = Number(this.actual);
    const tol = Math.pow(10, -digits) / 2;
    this.check(Math.abs(a - expected) <= tol, `应接近 ${expected}（容差 ${tol}）`);
  }

  toBeGreaterThan(n: number): void {
    this.check(Number(this.actual) > n, `应大于 ${n}`);
  }

  toBeGreaterThanOrEqual(n: number): void {
    this.check(Number(this.actual) >= n, `应大于等于 ${n}`);
  }

  toBeLessThan(n: number): void {
    this.check(Number(this.actual) < n, `应小于 ${n}`);
  }

  toBeLessThanOrEqual(n: number): void {
    this.check(Number(this.actual) <= n, `应小于等于 ${n}`);
  }

  toContain(v: unknown): void {
    const a = this.actual;
    if (typeof a === "string") this.check(a.includes(String(v)), `应包含 ${fmt(v)}`);
    else if (Array.isArray(a)) this.check(a.some((x) => deepEqual(x, v)), `应包含 ${fmt(v)}`);
    else this.check(false, `不建议对 ${typeof a} 使用 toContain`);
  }

  toHaveLength(n: number): void {
    this.check((this.actual as { length?: number })?.length === n, `长度应为 ${n}`);
  }

  toThrow(): void {
    let threw = false;
    try {
      (this.actual as Fn)();
    } catch {
      threw = true;
    }
    this.check(threw, "应抛异常");
  }
}

export function expect(actual: unknown, msg?: string): Expectation {
  return new Expectation(actual, false, msg);
}

/* ------------------------------------------------------------------ 运行 */

export interface RunResult {
  passed: number;
  failed: number;
  failures: { name: string; error: string }[];
}

export async function runAll(): Promise<RunResult> {
  let passed = 0;
  const failures: { name: string; error: string }[] = [];

  for (const hook of beforeAllHooks) await hook();

  for (const c of cases) {
    const full = [...c.suite, c.name].join(" › ");
    try {
      await c.fn();
      passed++;
      console.log(`  ✓ ${full}`);
    } catch (e) {
      failures.push({ name: full, error: (e as Error).message ?? String(e) });
      console.log(`  ✗ ${full}`);
      console.log(`      ${(e as Error).message ?? String(e)}`);
    }
  }

  return { passed, failed: failures.length, failures };
}

/** 供测试文件读取内部状态（runner 用不到，但便于自检） */
export function stats() {
  return { cases: cases.length, suites: suites.length };
}
