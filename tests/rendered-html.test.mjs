import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Horizon Guard application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Horizon Guard/);
  assert.match(html, /Horizon Guard/);
  assert.match(html, /HSK Chain/);
  assert.match(html, /72 小时沙盒/);
  assert.match(html, /0xc0043c0ecdc68401366d92bb46fd5721a4096153/i);
});

test("includes the deployed non-custodial registry source", async () => {
  const source = await readFile(
    new URL("../contracts/HorizonRiskRegistry.sol", import.meta.url),
    "utf8",
  );

  assert.match(source, /contract HorizonRiskRegistry/);
  assert.match(source, /function registerReport/);
  assert.match(source, /function getReport/);
  assert.doesNotMatch(source, /selfdestruct|delegatecall|transferFrom|\.transfer\(/i);
});
