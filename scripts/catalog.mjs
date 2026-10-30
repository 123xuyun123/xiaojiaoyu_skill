#!/usr/bin/env node
/**
 * 从站点前端 bundle 中提取全部 /api/v3 接口，生成接口目录。
 *
 *   node scripts/catalog.mjs [--base https://www.xinjiaoyu.com] [--page /home/]
 *
 * 产出：
 *   references/api-index.json   机器可读 [{ path, method }]
 *   references/api-catalog.md   按服务分组的可读目录
 *
 * 站点发版后重新跑一次即可更新。提取不到的方法标记为 "?"，
 * 调用时可用 `xjy.mjs api` 逐个尝试，或按 SKILL.md 的抓包流程补一次。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..");
const outDir = join(skillRoot, "references");

const args = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const base = getFlag("--base", "https://www.xinjiaoyu.com").replace(/\/+$/, "");
const page = getFlag("--page", "/home/");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function text(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const html = await text(base + page);
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
const urls = [...new Set(scripts.map((s) => (s.startsWith("http") ? s : base + (s.startsWith("/") ? "" : "/") + s)))];

console.error(`发现 ${urls.length} 个入口脚本，开始下载…`);

const sources = [];
for (const url of urls) {
  try {
    sources.push({ url, body: await text(url) });
    console.error(`  ok ${url.split("/").pop()} (${(sources.at(-1).body.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`  skip ${url}: ${e.message}`);
  }
}

const methodOf = (body, index) => {
  const start = Math.max(0, index - 200);
  const end = Math.min(body.length, index + 400);
  const win = body.slice(start, end);
  const found = [...win.matchAll(/method\s*:\s*["'](get|post|put|delete|patch)["']/gi)].map((m) =>
    m[1].toUpperCase(),
  );
  return found.length ? [...new Set(found)].join("|") : "?";
};

const normalize = (raw) => {
  let p = raw.replace(/["',;)\]]+$/, "");
  p = p.replace(/\$\{[^}]*\}/g, "{var}");
  p = p.replace(/\/{2,}/g, "/");
  p = p.replace(/\/\d{4,}(?=\/|$)/g, "/{id}");
  return p;
};

const map = new Map();
for (const { body } of sources) {
  const re = /\/api\/v3\/[A-Za-z0-9_/\-{}.:$]*/g;
  let m;
  while ((m = re.exec(body))) {
    const path = normalize(m[0]);
    if (path.length < 14 || path.endsWith("/")) continue;
    if (path.includes("${") || path.includes("server_${")) continue;
    if (!/^\/api\/v3\/[a-z0-9_]+\/[a-z0-9_\-{}]+/i.test(path)) continue;
    const method = methodOf(body, m.index);
    const prev = map.get(path);
    if (!prev) map.set(path, method);
    else if (prev !== method && method !== "?") map.set(path, prev === "?" ? method : prev);
  }
}

const all = [...map.entries()]
  .map(([path, method]) => ({ path, method }))
  .sort((a, b) => a.path.localeCompare(b.path));

const byService = new Map();
for (const item of all) {
  const svc = item.path.split("/")[3] || "?";
  if (!byService.has(svc)) byService.set(svc, []);
  byService.get(svc).push(item);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "api-index.json"), JSON.stringify(all, null, 2));

const lines = [
  "# 接口目录（自动生成）",
  "",
  `来源：${base}${page} 的前端 bundle，生成时间 ${new Date().toISOString()}`,
  "",
  `共 ${all.length} 个路径。\`?\` 表示未从代码里识别出 HTTP 方法。`,
  "",
  "> 这是**机器扫描**得到的全量清单，不代表都验证过。能直接用的、带参数说明的接口见 `endpoints.md`。",
  "> 站点发版后运行 `node scripts/catalog.mjs` 重新生成。",
  "",
  "## 服务概览",
  "",
  "| 服务 | 路径数 |",
  "| --- | --- |",
  ...[...byService.entries()].sort((a, b) => b[1].length - a[1].length).map(([s, v]) => `| ${s} | ${v.length} |`),
  "",
];

for (const [svc, items] of [...byService.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`## ${svc}`, "", "| 方法 | 路径 |", "| --- | --- |");
  for (const it of items) lines.push(`| ${it.method} | \`${it.path}\` |`);
  lines.push("");
}

writeFileSync(join(outDir, "api-catalog.md"), lines.join("\n"));

console.error(`完成：${all.length} 个接口，${byService.size} 个服务`);
console.error(`  ${join(outDir, "api-index.json")}`);
console.error(`  ${join(outDir, "api-catalog.md")}`);
