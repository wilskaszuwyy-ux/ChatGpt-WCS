import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("la pagina principal carga los recursos offline del dashboard", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="app"/);
  assert.match(html, /src="src\/app.js"/);
  assert.match(html, /src="src\/reportData.js"/);
  assert.match(html, /src="src\/dashboardLogic.js"/);
  assert.match(html, /href="src\/styles.css"/);
  assert.doesNotMatch(html, /type="module"/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("los recursos principales no declaran dependencias externas", () => {
  const resources = ["../index.html", "../src/styles.css", "../src/app.js", "../src/reportData.js", "../src/dashboardLogic.js"];

  for (const resource of resources) {
    const content = readFileSync(new URL(resource, import.meta.url), "utf8");
    assert.doesNotMatch(content, /https?:\/\//i, `${resource} no debe usar URLs externas`);
  }
});
