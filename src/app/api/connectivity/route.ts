/** 连通性测试：返回模型名、延迟、可用性。绝不回传 key。 */
import type { NextRequest } from "next/server";
import { publicConfig, testConnection } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(publicConfig());
}

export async function POST(_req: NextRequest) {
  const result = await testConnection();
  return Response.json({ ...result, config: publicConfig() });
}
