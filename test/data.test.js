import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.window = globalThis;

await import("../src/reportData.js");
await import("../src/dashboardLogic.js");

const { reportData } = globalThis;
const {
  calculateComponentTotals,
  calculatePhysicalGap,
  flattenSearchIndex,
  formatCurrency,
  getRiskLevel,
} = globalThis.dashboardLogic;

test("los componentes valorizados cuadran con el costo directo del informe", () => {
  const totals = calculateComponentTotals(reportData.components);

  assert.equal(totals.budget, reportData.financial.directCost);
  assert.equal(totals.current, reportData.financial.currentPhysicalAmount);
  assert.equal(totals.balance, reportData.financial.directCostBalance);
});

test("la brecha fisica identifica el leve retraso reportado", () => {
  const gap = calculatePhysicalGap(reportData.progress.programmed.currentPercent, reportData.progress.executed.currentPercent);

  assert.equal(gap.percent, -1.25);
  assert.equal(gap.label, "Leve retraso");
  assert.equal(getRiskLevel(gap.percent), "warning");
});

test("el indice de busqueda incluye informacion tecnica, presupuestal y normativa", () => {
  const index = flattenSearchIndex(reportData);

  assert.match(index, /directiva 017-2023-cg/i);
  assert.match(index, /wilber carbajal sulca/i);
  assert.match(index, /metrado/i);
  assert.match(index, /modulo prefabricado/i);
});

test("el formateo monetario conserva importes de valorizacion en soles", () => {
  assert.equal(formatCurrency(58320), "S/ 58,320.00");
  assert.equal(formatCurrency(25158.52), "S/ 25,158.52");
});

test("el presupuesto analitico modificado no se rotula como PIM 2026", () => {
  const totals = reportData.analyticalBudget.reduce(
    (sum, row) => ({
      modifiedBudget: sum.modifiedBudget + row.modifiedBudget,
      accumulatedExecuted: sum.accumulatedExecuted + row.accumulatedExecuted,
    }),
    { modifiedBudget: 0, accumulatedExecuted: 0 },
  );

  assert.equal(roundTwo(totals.modifiedBudget), reportData.financial.totalModifiedBudget);
  assert.equal(roundTwo(totals.accumulatedExecuted), 75770);
  assert.equal(reportData.financial.pim2026, 590798);
});

test("el PDF embebido es un documento offline valido", () => {
  const source = readFileSync(new URL("../src/pdfData.js", import.meta.url), "utf8");
  const match = source.match(/^globalThis\.informePdfBase64 = "([A-Za-z0-9+/=]+)";\n?$/);

  assert.ok(match, "pdfData.js debe declarar el PDF como dato local");
  const pdf = Buffer.from(match[1], "base64");
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(pdf.subarray(-1024).toString("latin1"), /%%EOF/);
});

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
