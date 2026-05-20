// Motor de calculo para valorizacion automatica de obra - Directiva 017-2023-CG
// Todas las funciones son puras (sin efectos laterales).

function roundMoney(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function roundPct(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function fmtMoneda(v) {
  return (
    "S/ " +
    new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v) || 0)
  );
}

function fmtPct(v) {
  return (
    new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v) || 0) + "%"
  );
}

// ---------------------------------------------------------------------------
// Calculos de presupuesto base (expediente tecnico)
// ---------------------------------------------------------------------------

function calcPresupuesto(presupuesto) {
  const {
    partidas = [],
    pctGastosGenerales = 0,
    pctSupervision = 0,
    montoLiquidacion = 0,
    montoExpediente = 0,
  } = presupuesto;

  const pctGG = Number(pctGastosGenerales) || 0;
  const pctSup = Number(pctSupervision) || 0;

  const partidasCalc = partidas.map((p) => ({
    ...p,
    parcial: roundMoney(Number(p.metrado) * Number(p.precioUnitario)),
  }));

  const costoDirecto = partidasCalc
    .filter((p) => p.tipo === "directo")
    .reduce((s, p) => roundMoney(s + p.parcial), 0);

  const gastosGenerales = roundMoney((costoDirecto * pctGG) / 100);
  const supervision = roundMoney((costoDirecto * pctSup) / 100);
  const liquidacion = roundMoney(Number(montoLiquidacion) || 0);
  const expediente = roundMoney(Number(montoExpediente) || 0);
  const totalObra = roundMoney(costoDirecto + gastosGenerales + supervision);
  const totalInversion = roundMoney(totalObra + liquidacion + expediente);

  return {
    partidasCalc,
    costoDirecto,
    gastosGenerales,
    supervision,
    liquidacion,
    expediente,
    totalObra,
    totalInversion,
    pctGG,
    pctSup,
  };
}

// ---------------------------------------------------------------------------
// Calculo de una valorizacion mensual especifica (por indice)
// ---------------------------------------------------------------------------

function calcValorizacion(valorizacionIndex, valorizaciones, presupuesto) {
  const presCalc = calcPresupuesto(presupuesto);
  const { pctGG, pctSup } = presCalc;

  const itemsCalc = presCalc.partidasCalc.map((partida) => {
    const valActual = valorizaciones[valorizacionIndex] || {};
    const itemMes = (valActual.items || []).find(
      (i) => i.idPartida === partida.id,
    ) || { metradoMes: 0 };

    const metradoMes = roundMoney(Number(itemMes.metradoMes) || 0);
    const importeMes = roundMoney(metradoMes * Number(partida.precioUnitario));

    // Acumulados hasta este periodo (inclusive)
    let metradoAcum = 0;
    let importeAcum = 0;
    for (let i = 0; i <= valorizacionIndex; i++) {
      const it = (valorizaciones[i]?.items || []).find(
        (x) => x.idPartida === partida.id,
      );
      const mq = roundMoney(Number(it?.metradoMes) || 0);
      metradoAcum = roundMoney(metradoAcum + mq);
      importeAcum = roundMoney(
        importeAcum + mq * Number(partida.precioUnitario),
      );
    }

    const avancePct =
      partida.parcial > 0
        ? roundPct((importeAcum / partida.parcial) * 100)
        : 0;
    const saldo = roundMoney(partida.parcial - importeAcum);

    return {
      ...partida,
      metradoMes,
      importeMes,
      metradoAcum,
      importeAcum,
      avancePct,
      saldo,
    };
  });

  const directos = itemsCalc.filter((i) => i.tipo === "directo");

  const cdMes = directos.reduce((s, i) => roundMoney(s + i.importeMes), 0);
  const cdAcum = directos.reduce((s, i) => roundMoney(s + i.importeAcum), 0);

  const ggMes = roundMoney((cdMes * pctGG) / 100);
  const supMes = roundMoney((cdMes * pctSup) / 100);
  const totalMes = roundMoney(cdMes + ggMes + supMes);

  const ggAcum = roundMoney((cdAcum * pctGG) / 100);
  const supAcum = roundMoney((cdAcum * pctSup) / 100);
  const totalAcum = roundMoney(cdAcum + ggAcum + supAcum);

  const avanceFisicoAcum =
    presCalc.costoDirecto > 0
      ? roundPct((cdAcum / presCalc.costoDirecto) * 100)
      : 0;

  const valActual = valorizaciones[valorizacionIndex] || {};
  const devengadoMes = roundMoney(Number(valActual.devengado) || 0);
  const pimVigente = roundMoney(Number(valActual.pim) || 0);

  let devengadoAcum = 0;
  for (let i = 0; i <= valorizacionIndex; i++) {
    devengadoAcum = roundMoney(
      devengadoAcum + (Number(valorizaciones[i]?.devengado) || 0),
    );
  }

  const avanceFinancieroAcum =
    pimVigente > 0 ? roundPct((devengadoAcum / pimVigente) * 100) : 0;

  const saldoCostoDirecto = roundMoney(presCalc.costoDirecto - cdAcum);
  const saldoObra = roundMoney(presCalc.totalObra - totalAcum);

  return {
    itemsCalc,
    cdMes,
    ggMes,
    supMes,
    totalMes,
    cdAcum,
    ggAcum,
    supAcum,
    totalAcum,
    avanceFisicoAcum,
    devengadoMes,
    devengadoAcum,
    pimVigente,
    avanceFinancieroAcum,
    saldoCostoDirecto,
    saldoObra,
    presCalc,
  };
}

// ---------------------------------------------------------------------------
// Datos para la Curva S
// ---------------------------------------------------------------------------

function calcCurvaS(cronograma, valorizaciones, presupuesto) {
  const presCalc = calcPresupuesto(presupuesto);
  const meses = cronograma.meses || [];

  // Porcentajes acumulados programados se derivan de la suma de mensuales
  let programadoAcum = 0;

  return meses.map((mesConfig, index) => {
    programadoAcum = roundPct(
      programadoAcum + (Number(mesConfig.porcentajeMensual) || 0),
    );

    let cdAcum = 0;
    let devengadoAcum = 0;

    const pimVigente =
      index < valorizaciones.length
        ? Number(valorizaciones[index]?.pim) || 0
        : valorizaciones.length > 0
          ? Number(valorizaciones[valorizaciones.length - 1]?.pim) || 0
          : 0;

    for (let i = 0; i <= index && i < valorizaciones.length; i++) {
      const val = valorizaciones[i] || {};
      for (const item of val.items || []) {
        const partida = presCalc.partidasCalc.find(
          (p) => p.id === item.idPartida,
        );
        if (partida && partida.tipo === "directo") {
          const mq = Number(item.metradoMes) || 0;
          cdAcum = roundMoney(cdAcum + mq * Number(partida.precioUnitario));
        }
      }
      devengadoAcum = roundMoney(
        devengadoAcum + (Number(val.devengado) || 0),
      );
    }

    const fisicoAcum =
      presCalc.costoDirecto > 0
        ? roundPct((cdAcum / presCalc.costoDirecto) * 100)
        : 0;

    const financieroAcum =
      pimVigente > 0 ? roundPct((devengadoAcum / pimVigente) * 100) : 0;

    return {
      mes: mesConfig.descripcion || `Mes ${index + 1}`,
      programadoMensPct: roundPct(Number(mesConfig.porcentajeMensual) || 0),
      programadoAcumPct: programadoAcum,
      fisicoAcumPct: fisicoAcum,
      financieroAcumPct: financieroAcum,
    };
  });
}

// ---------------------------------------------------------------------------
// Clasificacion de brecha fisica
// ---------------------------------------------------------------------------

function getBrechaCondicion(brecha) {
  const b = Number(brecha) || 0;
  if (b <= -10) return { nivel: "danger", texto: "Retraso significativo" };
  if (b < 0) return { nivel: "warning", texto: "Leve retraso" };
  if (b === 0) return { nivel: "neutral", texto: "En plazo" };
  return { nivel: "success", texto: "Adelantada" };
}

// ---------------------------------------------------------------------------
// Generacion de porcentajes acumulados en el cronograma
// ---------------------------------------------------------------------------

function calcCronogramaAcumulados(meses) {
  let acum = 0;
  return (meses || []).map((m) => {
    acum = roundPct(acum + (Number(m.porcentajeMensual) || 0));
    return { ...m, porcentajeAcumulado: acum };
  });
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

globalThis.valorizacionLogic = {
  roundMoney,
  roundPct,
  fmtMoneda,
  fmtPct,
  calcPresupuesto,
  calcValorizacion,
  calcCurvaS,
  calcCronogramaAcumulados,
  getBrechaCondicion,
};
