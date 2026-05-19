// Tests del motor de calculo y la herramienta de valorizacion automatica.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Simular entorno de navegador para los modulos que usan globalThis
globalThis.window = globalThis;

await import("../src/valorizacionLogic.js");

const {
  roundMoney,
  roundPct,
  fmtMoneda,
  fmtPct,
  calcPresupuesto,
  calcValorizacion,
  calcCurvaS,
  calcCronogramaAcumulados,
  getBrechaCondicion,
} = globalThis.valorizacionLogic;

// -------------------------------------------------------------------------
// Utilidades numericas
// -------------------------------------------------------------------------

test("roundMoney elimina errores de punto flotante", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(1234.555), 1234.56);
  assert.equal(roundMoney(0), 0);
});

test("fmtMoneda formatea correctamente en soles peruanos", () => {
  assert.ok(fmtMoneda(58320).includes("58,320.00"));
  assert.ok(fmtMoneda(25158.52).includes("25,158.52"));
  assert.ok(fmtMoneda(0).includes("0.00"));
});

test("fmtPct formatea porcentaje con dos decimales", () => {
  assert.ok(fmtPct(5.96).includes("5.96%"));
  assert.ok(fmtPct(100).includes("100.00%"));
  assert.ok(fmtPct(0).includes("0.00%"));
});

// -------------------------------------------------------------------------
// calcPresupuesto: calculo base del expediente tecnico
// -------------------------------------------------------------------------

function presupuestoEjemplo() {
  return {
    partidas: [
      { id: "p1", codigo: "01.01", descripcion: "Obras provisionales", und: "glb", metrado: 1, precioUnitario: 5000, tipo: "directo" },
      { id: "p2", codigo: "01.02", descripcion: "Estructuras", und: "m3", metrado: 10, precioUnitario: 800, tipo: "directo" },
      { id: "p3", codigo: "01.03", descripcion: "Arquitectura", und: "m2", metrado: 50, precioUnitario: 120, tipo: "directo" },
    ],
    pctGastosGenerales: 25,
    pctSupervision: 8,
    montoLiquidacion: 5000,
    montoExpediente: 10000,
  };
}

test("calcPresupuesto calcula el costo directo sumando parciales", () => {
  const pr = presupuestoEjemplo();
  const result = calcPresupuesto(pr);

  // CD = 1×5000 + 10×800 + 50×120 = 5000+8000+6000 = 19000
  assert.equal(result.costoDirecto, 19000);
  assert.equal(result.partidasCalc[0].parcial, 5000);
  assert.equal(result.partidasCalc[1].parcial, 8000);
  assert.equal(result.partidasCalc[2].parcial, 6000);
});

test("calcPresupuesto calcula costos indirectos como porcentaje del CD", () => {
  const result = calcPresupuesto(presupuestoEjemplo());

  // GG = 19000 × 25% = 4750
  assert.equal(result.gastosGenerales, 4750);
  // Supervision = 19000 × 8% = 1520
  assert.equal(result.supervision, 1520);
  // Total obra = 19000 + 4750 + 1520 = 25270
  assert.equal(result.totalObra, 25270);
  // Total inversion = 25270 + 5000 + 10000 = 40270
  assert.equal(result.totalInversion, 40270);
});

test("calcPresupuesto maneja presupuesto vacio sin errores", () => {
  const result = calcPresupuesto({ partidas: [], pctGastosGenerales: 0, pctSupervision: 0 });

  assert.equal(result.costoDirecto, 0);
  assert.equal(result.totalObra, 0);
  assert.equal(result.totalInversion, 0);
});

// -------------------------------------------------------------------------
// calcValorizacion: calculo mensual y acumulados
// -------------------------------------------------------------------------

function valorizacionesEjemplo() {
  return [
    {
      numero: 1,
      periodo: "Abril 2026",
      pim: 40000,
      devengado: 3500,
      programadoAcumPct: 10,
      items: [
        { idPartida: "p1", metradoMes: 0.5 },   // 0.5 × 5000 = 2500
        { idPartida: "p2", metradoMes: 2 },     // 2 × 800 = 1600
        { idPartida: "p3", metradoMes: 0 },
      ],
    },
    {
      numero: 2,
      periodo: "Mayo 2026",
      pim: 40000,
      devengado: 6000,
      programadoAcumPct: 30,
      items: [
        { idPartida: "p1", metradoMes: 0.5 },   // 0.5 × 5000 = 2500
        { idPartida: "p2", metradoMes: 3 },     // 3 × 800 = 2400
        { idPartida: "p3", metradoMes: 10 },    // 10 × 120 = 1200
      ],
    },
  ];
}

test("calcValorizacion calcula importes del mes por partida", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();

  const vc = calcValorizacion(0, vals, pr);

  // cdMes = 2500 + 1600 + 0 = 4100
  assert.equal(vc.cdMes, 4100);
  // ggMes = 4100 × 25% = 1025
  assert.equal(vc.ggMes, 1025);
  // supMes = 4100 × 8% = 328
  assert.equal(vc.supMes, 328);
  // totalMes = 4100 + 1025 + 328 = 5453
  assert.equal(vc.totalMes, 5453);
});

test("calcValorizacion calcula acumulados correctamente al segundo periodo", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();

  const vc = calcValorizacion(1, vals, pr);

  // cdAcum = (2500+1600) + (2500+2400+1200) = 4100 + 6100 = 10200
  assert.equal(vc.cdAcum, 10200);
  // avanceFisicoAcum = 10200 / 19000 × 100 ≈ 53.68%
  assert.equal(vc.avanceFisicoAcum, roundPct(10200 / 19000 * 100));
});

test("calcValorizacion calcula avance financiero acumulado sobre PIM", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();

  const vc = calcValorizacion(1, vals, pr);

  // devengadoAcum = 3500 + 6000 = 9500
  assert.equal(vc.devengadoAcum, 9500);
  // avanceFinancieroAcum = 9500 / 40000 × 100 = 23.75%
  assert.equal(vc.avanceFinancieroAcum, 23.75);
});

test("calcValorizacion calcula el saldo del costo directo", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();
  const vc = calcValorizacion(0, vals, pr);

  // saldoCostoDirecto = 19000 - 4100 = 14900
  assert.equal(vc.saldoCostoDirecto, 14900);
});

test("calcValorizacion retorna avance por partida", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();
  const vc = calcValorizacion(0, vals, pr);

  const p1 = vc.itemsCalc.find(i => i.id === "p1");
  // avancePct p1 = 2500 / 5000 × 100 = 50%
  assert.equal(p1.avancePct, 50);
});

// -------------------------------------------------------------------------
// calcCronogramaAcumulados
// -------------------------------------------------------------------------

test("calcCronogramaAcumulados acumula porcentajes correctamente", () => {
  const meses = [
    { descripcion: "Mes 1", porcentajeMensual: 10 },
    { descripcion: "Mes 2", porcentajeMensual: 20 },
    { descripcion: "Mes 3", porcentajeMensual: 30 },
  ];
  const result = calcCronogramaAcumulados(meses);

  assert.equal(result[0].porcentajeAcumulado, 10);
  assert.equal(result[1].porcentajeAcumulado, 30);
  assert.equal(result[2].porcentajeAcumulado, 60);
});

test("calcCronogramaAcumulados maneja array vacio", () => {
  assert.deepEqual(calcCronogramaAcumulados([]), []);
});

// -------------------------------------------------------------------------
// calcCurvaS
// -------------------------------------------------------------------------

test("calcCurvaS genera datos para todos los periodos del cronograma", () => {
  const pr = presupuestoEjemplo();
  const vals = valorizacionesEjemplo();
  const cr = {
    fechaInicio: "2026-04-01",
    plazoAprobado: 90,
    meses: [
      { descripcion: "Abril 2026", porcentajeMensual: 10 },
      { descripcion: "Mayo 2026", porcentajeMensual: 20 },
      { descripcion: "Junio 2026", porcentajeMensual: 70 },
    ],
  };

  const curvaS = calcCurvaS(cr, vals, pr);

  assert.equal(curvaS.length, 3);
  assert.equal(curvaS[0].programadoAcumPct, 10);
  assert.equal(curvaS[1].programadoAcumPct, 30);
  assert.equal(curvaS[2].programadoAcumPct, 100);

  // El avance fisico acumulado en mayo debe coincidir con calcValorizacion(1,...)
  const vcMayo = calcValorizacion(1, vals, pr);
  assert.equal(curvaS[1].fisicoAcumPct, vcMayo.avanceFisicoAcum);
});

// -------------------------------------------------------------------------
// getBrechaCondicion
// -------------------------------------------------------------------------

test("getBrechaCondicion clasifica correctamente la condicion de la obra", () => {
  assert.equal(getBrechaCondicion(0).texto, "En plazo");
  assert.equal(getBrechaCondicion(2).texto, "Adelantada");
  assert.equal(getBrechaCondicion(-3).texto, "Leve retraso");
  assert.equal(getBrechaCondicion(-15).texto, "Retraso significativo");

  assert.equal(getBrechaCondicion(0).nivel, "neutral");
  assert.equal(getBrechaCondicion(-3).nivel, "warning");
  assert.equal(getBrechaCondicion(-15).nivel, "danger");
});

// -------------------------------------------------------------------------
// Herramienta HTML: recursos offline
// -------------------------------------------------------------------------

test("valorization.html carga sus recursos sin CDN externo", () => {
  const html = readFileSync(new URL("../valorization.html", import.meta.url), "utf8");

  assert.match(html, /id="vapp"/);
  assert.match(html, /src="src\/valorizacionLogic\.js"/);
  assert.match(html, /src="src\/valorizacionExport\.js"/);
  assert.match(html, /src="src\/valorizacionApp\.js"/);
  assert.match(html, /href="src\/valorizacion\.css"/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /type="module"/i);
});

test("los archivos JS de valorizacion no tienen dependencias externas", () => {
  const files = [
    "../src/valorizacionLogic.js",
    "../src/valorizacionExport.js",
    "../src/valorizacionApp.js",
    "../src/valorizacion.css",
  ];

  for (const file of files) {
    const content = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      content,
      /https?:\/\//i,
      `${file} no debe usar URLs externas`,
    );
  }
});
