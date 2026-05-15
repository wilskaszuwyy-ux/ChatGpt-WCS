import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("la pagina principal carga los recursos offline del dashboard", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="app"/);
  assert.match(html, /src="src\/app.js"/);
  assert.match(html, /href="src\/styles.css"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});
