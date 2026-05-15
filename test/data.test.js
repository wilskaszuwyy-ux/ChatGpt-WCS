import test from "node:test";
import assert from "node:assert/strict";

import { reportData } from "../src/reportData.js";
import {
  calculateComponentTotals,
  calculatePhysicalGap,
  flattenSearchIndex,
  formatCurrency,
  getRiskLevel,
} from "../src/dashboardLogic.js";

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
