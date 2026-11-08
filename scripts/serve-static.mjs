/**
 * 零依赖静态服务器 —— 用来本地验证 out/ 产物（等价于 GitHub Pages 的行为）。
 *
 * 用法：node scripts/serve-static.mjs [port] [basePath]
 *   例：node scripts/serve-static.mjs 4000 /ai-ppt
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] ?? 4000);
const basePath = (process.argv[3] ?? "").replace(/\/$/, "");
const root = path.resolve("out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function resolveFile(urlPath) {
  let p = urlPath.split("?")[0];
  if (basePath && p.startsWith(basePath)) p = p.slice(basePath.length);
  if (p === "" || p === "/") p = "/index.html";
  const abs = path.join(root, decodeURIComponent(p));
  if (!abs.startsWith(root)) return null;

  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  // 目录式路由：/editor -> /editor/index.html
  const asDir = path.join(abs, "index.html");
  if (fs.existsSync(asDir)) return asDir;
  // 无扩展名时补 .html
  const asHtml = `${abs}.html`;
  if (fs.existsSync(asHtml)) return asHtml;
  return null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? "/");
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end(`404 ${req.url}`);
      console.log(`404 ${req.url}`);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
    console.log(`200 ${req.url} -> ${path.relative(root, file)}`);
  })
  .listen(port, () => {
    console.log(`静态站已启动：http://localhost:${port}${basePath || ""}`);
    console.log(`根目录：${root}`);
  });
