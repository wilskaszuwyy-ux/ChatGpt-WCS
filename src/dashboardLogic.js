function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateComponentTotals(components) {
  return components.reduce(
    (totals, component) => ({
      budget: roundMoney(totals.budget + component.budget),
      current: roundMoney(totals.current + component.current),
      accumulated: roundMoney(totals.accumulated + component.accumulated),
      balance: roundMoney(totals.balance + component.balance),
    }),
    { budget: 0, current: 0, accumulated: 0, balance: 0 },
  );
}

function calculatePhysicalGap(programmedPercent, executedPercent) {
  const percent = roundMoney(Number(executedPercent) - Number(programmedPercent));
  return {
    percent,
    label: percent < 0 ? "Leve retraso" : percent === 0 ? "En plazo" : "Adelantada",
  };
}

function getRiskLevel(gapPercent) {
  if (gapPercent <= -10) return "danger";
  if (gapPercent < 0) return "warning";
  return "success";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace(/^/, "S/ ");
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function flattenSearchIndex(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(flattenSearchIndex).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenSearchIndex).join(" ");
  return String(value);
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesQuery(row, query) {
  if (!query.trim()) return true;
  return normalizeText(flattenSearchIndex(row)).includes(normalizeText(query));
}

function calculateExecutionRatio(executed, budget) {
  if (!budget) return 0;
  return roundMoney((Number(executed) / Number(budget)) * 100);
}

globalThis.dashboardLogic = {
  calculateComponentTotals,
  calculateExecutionRatio,
  calculatePhysicalGap,
  flattenSearchIndex,
  formatCurrency,
  formatPercent,
  getRiskLevel,
  matchesQuery,
  normalizeText,
  roundMoney,
};
