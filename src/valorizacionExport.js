// Exportacion de valorizacion a Excel usando formato SpreadsheetML (XML 2003)
// Compatible con Microsoft Excel sin dependencias externas.

(function () {
  const { calcPresupuesto, calcValorizacion, calcCurvaS, calcCronogramaAcumulados, fmtMoneda, fmtPct } =
    globalThis.valorizacionLogic;

  // -------------------------------------------------------------------------
  // Utilidades XML
  // -------------------------------------------------------------------------

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function num(v) {
    return Number(v) || 0;
  }

  function cell(value, styleId, type) {
    const t = type || (typeof value === "number" ? "Number" : "String");
    const s = styleId ? ` ss:StyleID="${styleId}"` : "";
    const d = t === "Number" ? num(value) : esc(value);
    return `<Cell${s}><Data ss:Type="${t}">${d}</Data></Cell>`;
  }

  function cellMerge(value, across, styleId, type) {
    const t = type || (typeof value === "number" ? "Number" : "String");
    const s = styleId ? ` ss:StyleID="${styleId}"` : "";
    const m = across > 0 ? ` ss:MergeAcross="${across}"` : "";
    const d = t === "Number" ? num(value) : esc(value);
    return `<Cell${s}${m}><Data ss:Type="${t}">${d}</Data></Cell>`;
  }

  function emptyCell(n) {
    return Array(n || 1)
      .fill("<Cell/>")
      .join("");
  }

  function row(...cells) {
    return `<Row>${cells.join("")}</Row>`;
  }

  function rowH(height, ...cells) {
    return `<Row ss:Height="${height}">${cells.join("")}</Row>`;
  }

  function spacerRow(span) {
    return `<Row><Cell ss:MergeAcross="${span - 1}"><Data ss:Type="String"> </Data></Cell></Row>`;
  }

  // -------------------------------------------------------------------------
  // Definicion de estilos
  // -------------------------------------------------------------------------

  const STYLES = `
  <Styles>
    <Style ss:ID="s0"/>
    <Style ss:ID="sTitulo">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="14" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#093C3A" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F766E"/>
      </Borders>
    </Style>
    <Style ss:ID="sSubtitulo">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFFFFF"/>
      </Borders>
    </Style>
    <Style ss:ID="sHeaderGray">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1" ss:Size="9"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="sLabel">
      <Font ss:Bold="1" ss:Size="9"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="sValue">
      <Font ss:Size="9"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="sMoney">
      <NumberFormat ss:Format="#,##0.00"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Size="9"/>
    </Style>
    <Style ss:ID="sMoneyBold">
      <NumberFormat ss:Format="#,##0.00"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9"/>
    </Style>
    <Style ss:ID="sPct">
      <NumberFormat ss:Format="0.00&quot;%&quot;"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Size="9"/>
    </Style>
    <Style ss:ID="sPctBold">
      <NumberFormat ss:Format="0.00&quot;%&quot;"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9"/>
    </Style>
    <Style ss:ID="sTotal">
      <NumberFormat ss:Format="#,##0.00"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#14532D"/>
      <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#15803D"/>
      </Borders>
    </Style>
    <Style ss:ID="sTotalLabel">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#14532D"/>
      <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#15803D"/>
      </Borders>
    </Style>
    <Style ss:ID="sWarning">
      <NumberFormat ss:Format="#,##0.00"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sWarningLabel">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Size="9" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sOdd">
      <Font ss:Size="9"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="sOddMoney">
      <NumberFormat ss:Format="#,##0.00"/>
      <Font ss:Size="9"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sCheckOk">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Color="#15803D" ss:Size="9"/>
      <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sCheckObs">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Color="#92400E" ss:Size="9"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sCheckNa">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:Bold="1" ss:Color="#64748B" ss:Size="9"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
    </Style>
  </Styles>`;

  // -------------------------------------------------------------------------
  // Hoja 1: Portada / Ficha Tecnica
  // -------------------------------------------------------------------------

  function hojaPortada(s) {
    const p = s.proyecto || {};
    const cr = s.cronograma || {};
    const presCalc = calcPresupuesto(s.presupuesto || {});
    const valIdx = (s.valorizaciones || []).length - 1;
    let avanceFisico = 0;
    let avanceFinanciero = 0;
    let condicion = "Sin valorizaciones";
    if (valIdx >= 0) {
      const vc = calcValorizacion(valIdx, s.valorizaciones, s.presupuesto);
      avanceFisico = vc.avanceFisicoAcum;
      avanceFinanciero = vc.avanceFinancieroAcum;
      condicion =
        avanceFisico < (s.valorizaciones[valIdx]?.programadoAcumPct || 0) - 5
          ? "Retraso significativo"
          : avanceFisico < (s.valorizaciones[valIdx]?.programadoAcumPct || 0)
            ? "Leve retraso"
            : "En plazo / Adelantada";
    }

    const filas = [
      rowH(
        36,
        cellMerge(
          "INFORME MENSUAL DE SUPERVISION Y VALORIZACION DE OBRA",
          9,
          "sTitulo",
        ),
      ),
      rowH(
        24,
        cellMerge(
          "Directiva 017-2023-CG | Obra por Administracion Directa",
          9,
          "sSubtitulo",
        ),
      ),
      spacerRow(10),
      row(
        cell("DATOS DE LA ENTIDAD", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Entidad:", "sLabel"),
        cellMerge(p.entidad || "", 8, "sValue"),
      ),
      row(
        cell("Area:", "sLabel"),
        cellMerge(p.area || "", 3, "sValue"),
        cell("Unidad:", "sLabel"),
        cellMerge(p.unidad || "", 4, "sValue"),
      ),
      spacerRow(10),
      row(
        cell("DATOS DEL PROYECTO", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Nombre del proyecto:", "sLabel"),
        cellMerge(p.nombre || "", 8, "sValue"),
      ),
      row(
        cell("CUI:", "sLabel"),
        cellMerge(p.cui || "", 3, "sValue"),
        cell("Modalidad:", "sLabel"),
        cellMerge(p.modalidad || "Administracion directa", 4, "sValue"),
      ),
      row(
        cell("Sector:", "sLabel"),
        cellMerge(p.sector || "", 3, "sValue"),
        cell("Fuente financ.:", "sLabel"),
        cellMerge(p.fuenteFinanciamiento || "", 4, "sValue"),
      ),
      row(
        cell("Departamento:", "sLabel"),
        cell(p.departamento || "", "sValue"),
        cell("Provincia:", "sLabel"),
        cell(p.provincia || "", "sValue"),
        cell("Distrito:", "sLabel"),
        cell(p.distrito || "", "sValue"),
        cell("Localidad:", "sLabel"),
        cellMerge(p.localidad || "", 2, "sValue"),
      ),
      row(
        cell("Doc. aprobacion:", "sLabel"),
        cellMerge(p.documentoAprobacion || "", 3, "sValue"),
        cell("Fecha aprobacion:", "sLabel"),
        cellMerge(p.fechaAprobacion || "", 4, "sValue"),
      ),
      spacerRow(10),
      row(
        cell("CRONOGRAMA DE EJECUCION", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Fecha de inicio:", "sLabel"),
        cellMerge(cr.fechaInicio || "", 3, "sValue"),
        cell("Plazo aprobado:", "sLabel"),
        cellMerge(`${num(cr.plazoAprobado)} dias calendario`, 4, "sValue"),
      ),
      spacerRow(10),
      row(
        cell("RESPONSABLES TECNICOS", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Supervisor:", "sLabel"),
        cellMerge(
          `${(p.supervisor || {}).nombre || ""} | Reg.: ${(p.supervisor || {}).registro || ""} | DNI: ${(p.supervisor || {}).dni || ""}`,
          8,
          "sValue",
        ),
      ),
      row(
        cell("Residente:", "sLabel"),
        cellMerge(
          `${(p.residente || {}).nombre || ""} | Reg.: ${(p.residente || {}).registro || ""} | DNI: ${(p.residente || {}).dni || ""}`,
          8,
          "sValue",
        ),
      ),
      spacerRow(10),
      row(
        cell("RESUMEN FINANCIERO DEL PROYECTO", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Costo directo (presupuesto):", "sLabel"),
        cell(presCalc.costoDirecto, "sMoneyBold", "Number"),
        cell("Gastos generales:", "sLabel"),
        cell(presCalc.gastosGenerales, "sMoney", "Number"),
        cell("Supervision:", "sLabel"),
        cell(presCalc.supervision, "sMoney", "Number"),
        emptyCell(3),
      ),
      row(
        cell("Total presupuesto de obra:", "sLabel"),
        cell(presCalc.totalObra, "sMoneyBold", "Number"),
        cell("Liquidacion:", "sLabel"),
        cell(presCalc.liquidacion, "sMoney", "Number"),
        cell("Expediente tecnico:", "sLabel"),
        cell(presCalc.expediente, "sMoney", "Number"),
        emptyCell(3),
      ),
      row(
        cell("Inversion total:", "sLabel"),
        cell(presCalc.totalInversion, "sTotal", "Number"),
        emptyCell(8),
      ),
      spacerRow(10),
      row(
        cell("ESTADO DE AVANCE (ACUMULADO)", "sSubtitulo"),
        emptyCell(9),
      ),
      row(
        cell("Avance fisico acumulado (CD):", "sLabel"),
        cell(avanceFisico, "sPctBold", "Number"),
        cell("Avance financiero acumulado (PIM):", "sLabel"),
        cell(avanceFinanciero, "sPctBold", "Number"),
        cell("Condicion:", "sLabel"),
        cellMerge(condicion, 4, avanceFisico < 0 ? "sWarningLabel" : "sTotalLabel"),
      ),
    ];

    return `
    <Worksheet ss:Name="Portada">
      <Table ss:DefaultColumnWidth="100">
        <Column ss:Width="140"/>
        <Column ss:Width="130"/>
        <Column ss:Width="100"/>
        <Column ss:Width="130"/>
        <Column ss:Width="100"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        <Column ss:Width="100"/>
        <Column ss:Width="100"/>
        <Column ss:Width="100"/>
        ${filas.join("\n")}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Hoja 2: Valorizacion mensual detallada
  // -------------------------------------------------------------------------

  function hojaValorizacion(s, valIdx) {
    const val = (s.valorizaciones || [])[valIdx];
    if (!val) return "";

    const vc = calcValorizacion(valIdx, s.valorizaciones, s.presupuesto);

    const encabezado = [
      rowH(
        30,
        cellMerge(
          `VALORIZACION N° ${String(valIdx + 1).padStart(2, "0")} | ${val.periodo || ""} | ${(s.proyecto || {}).nombre || ""}`,
          11,
          "sTitulo",
        ),
      ),
      row(
        cellMerge(
          `CUI: ${(s.proyecto || {}).cui || ""} | Directiva 017-2023-CG | Administracion directa`,
          11,
          "sSubtitulo",
        ),
      ),
      spacerRow(12),
      row(
        cell("ITEM", "sHeader"),
        cell("CODIGO", "sHeader"),
        cell("DESCRIPCION", "sHeader"),
        cell("UND", "sHeader"),
        cell("METRADO\nEXPEDIENTE", "sHeader"),
        cell("P.U. (S/)", "sHeader"),
        cell("PARCIAL\nPRESUP.", "sHeader"),
        cell("METRADO\nMES", "sHeader"),
        cell("IMPORTE\nMES (S/)", "sHeader"),
        cell("METRADO\nACUM.", "sHeader"),
        cell("IMPORTE\nACUM. (S/)", "sHeader"),
        cell("AVANCE %", "sHeader"),
      ),
    ];

    let itemNum = 0;
    const filas = vc.itemsCalc.map((item) => {
      itemNum++;
      const estilo = itemNum % 2 === 0 ? "sOddMoney" : "sMoney";
      const estiloBase = itemNum % 2 === 0 ? "sOdd" : "s0";
      return row(
        cell(String(itemNum), estiloBase),
        cell(item.codigo || "", estiloBase),
        cell(item.descripcion || "", estiloBase),
        cell(item.und || "", estiloBase),
        cell(num(item.metrado), estilo, "Number"),
        cell(num(item.precioUnitario), estilo, "Number"),
        cell(num(item.parcial), estilo, "Number"),
        cell(num(item.metradoMes), estilo, "Number"),
        cell(num(item.importeMes), estilo, "Number"),
        cell(num(item.metradoAcum), estilo, "Number"),
        cell(num(item.importeAcum), estilo, "Number"),
        cell(num(item.avancePct), "sPct", "Number"),
      );
    });

    const totales = [
      spacerRow(12),
      row(
        cellMerge("RESUMEN DE VALORIZACION", 5, "sTotalLabel"),
        emptyCell(6),
      ),
      row(
        cellMerge("Concepto", 5, "sHeaderGray"),
        cell("Presupuesto", "sHeaderGray"),
        emptyCell(1),
        cell("Val. Mes (S/)", "sHeaderGray"),
        emptyCell(1),
        cell("Val. Acumulada (S/)", "sHeaderGray"),
        emptyCell(1),
        cell("Saldo (S/)", "sHeaderGray"),
      ),
      row(
        cellMerge("Costo directo", 5, "s0"),
        cell(vc.presCalc.costoDirecto, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.cdMes, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.cdAcum, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.saldoCostoDirecto, "sMoney", "Number"),
      ),
      row(
        cellMerge(
          `Gastos generales (${vc.presCalc.pctGG}%)`,
          5,
          "s0",
        ),
        cell(vc.presCalc.gastosGenerales, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.ggMes, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.ggAcum, "sMoney", "Number"),
        emptyCell(1),
        cell(
          num(vc.presCalc.gastosGenerales) - num(vc.ggAcum),
          "sMoney",
          "Number",
        ),
      ),
      row(
        cellMerge(
          `Gastos de supervision (${vc.presCalc.pctSup}%)`,
          5,
          "s0",
        ),
        cell(vc.presCalc.supervision, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.supMes, "sMoney", "Number"),
        emptyCell(1),
        cell(vc.supAcum, "sMoney", "Number"),
        emptyCell(1),
        cell(
          num(vc.presCalc.supervision) - num(vc.supAcum),
          "sMoney",
          "Number",
        ),
      ),
      row(
        cellMerge("TOTAL PRESUPUESTO DE OBRA", 5, "sTotalLabel"),
        cell(vc.presCalc.totalObra, "sTotal", "Number"),
        emptyCell(1),
        cell(vc.totalMes, "sTotal", "Number"),
        emptyCell(1),
        cell(vc.totalAcum, "sTotal", "Number"),
        emptyCell(1),
        cell(vc.saldoObra, "sTotal", "Number"),
      ),
      spacerRow(12),
      row(
        cellMerge("AVANCE DEL PERIODO", 5, "sSubtitulo"),
        emptyCell(7),
      ),
      row(
        cell("Avance fisico acumulado CD:", "sLabel"),
        cell(vc.avanceFisicoAcum, "sPctBold", "Number"),
        emptyCell(2),
        cell("Devengado acumulado:", "sLabel"),
        cell(vc.devengadoAcum, "sMoneyBold", "Number"),
        emptyCell(2),
        cell("Avance financiero acumulado:", "sLabel"),
        cell(vc.avanceFinancieroAcum, "sPctBold", "Number"),
        emptyCell(2),
      ),
    ];

    return `
    <Worksheet ss:Name="Val N${valIdx + 1}">
      <Table ss:DefaultColumnWidth="80">
        <Column ss:Width="40"/>
        <Column ss:Width="100"/>
        <Column ss:Width="200"/>
        <Column ss:Width="50"/>
        <Column ss:Width="80"/>
        <Column ss:Width="80"/>
        <Column ss:Width="90"/>
        <Column ss:Width="80"/>
        <Column ss:Width="90"/>
        <Column ss:Width="80"/>
        <Column ss:Width="90"/>
        <Column ss:Width="70"/>
        ${encabezado.join("\n")}
        ${filas.join("\n")}
        ${totales.join("\n")}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Hoja 3: Cronograma comparado y Curva S
  // -------------------------------------------------------------------------

  function hojaCronograma(s) {
    const curvaS = calcCurvaS(
      s.cronograma || {},
      s.valorizaciones || [],
      s.presupuesto || {},
    );

    const encabezado = [
      rowH(
        30,
        cellMerge(
          `CRONOGRAMA COMPARADO - CURVA S | ${(s.proyecto || {}).nombre || ""}`,
          7,
          "sTitulo",
        ),
      ),
      row(
        cellMerge(
          `CUI: ${(s.proyecto || {}).cui || ""} | Directiva 017-2023-CG`,
          7,
          "sSubtitulo",
        ),
      ),
      spacerRow(8),
      row(
        cell("N°", "sHeader"),
        cell("PERIODO", "sHeader"),
        cell("% PROGRAMADO\nMENSUAL CD", "sHeader"),
        cell("% PROGRAMADO\nACUMULADO CD", "sHeader"),
        cell("% FISICO\nACUMULADO CD", "sHeader"),
        cell("% FINANCIERO\nACUM. PIM", "sHeader"),
        cell("BRECHA FISICA\nACUMULADA", "sHeader"),
      ),
    ];

    const filas = curvaS.map((m, i) => {
      const brecha = num(m.fisicoAcumPct) - num(m.programadoAcumPct);
      const estiloBrecha =
        brecha < -5 ? "sWarning" : brecha < 0 ? "sPct" : "sPct";
      return row(
        cell(i + 1, "s0", "Number"),
        cell(m.mes, "s0"),
        cell(num(m.programadoMensPct), "sPct", "Number"),
        cell(num(m.programadoAcumPct), "sPctBold", "Number"),
        cell(num(m.fisicoAcumPct), "sPct", "Number"),
        cell(num(m.financieroAcumPct), "sPct", "Number"),
        cell(brecha, estiloBrecha, "Number"),
      );
    });

    return `
    <Worksheet ss:Name="Cronograma-CurvaS">
      <Table ss:DefaultColumnWidth="100">
        <Column ss:Width="40"/>
        <Column ss:Width="140"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        <Column ss:Width="110"/>
        ${encabezado.join("\n")}
        ${filas.join("\n")}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Hoja 4: Personal
  // -------------------------------------------------------------------------

  function hojaPersonal(s) {
    const personal = s.personal || [];
    const encabezado = [
      rowH(
        30,
        cellMerge(
          `PERSONAL PROPUESTO Y PRESENTE | ${(s.proyecto || {}).nombre || ""}`,
          7,
          "sTitulo",
        ),
      ),
      row(
        cellMerge(
          `CUI: ${(s.proyecto || {}).cui || ""} | Directiva 017-2023-CG`,
          7,
          "sSubtitulo",
        ),
      ),
      spacerRow(8),
      row(
        cell("N°", "sHeader"),
        cell("NOMBRE Y APELLIDOS", "sHeader"),
        cell("CARGO / ROL", "sHeader"),
        cell("DNI", "sHeader"),
        cell("N° REGISTRO", "sHeader"),
        cell("MESES", "sHeader"),
        cell("DOCUMENTO DE VINCULACION", "sHeader"),
      ),
    ];
    const filas = personal.map((p, i) =>
      row(
        cell(i + 1, "s0", "Number"),
        cell(p.nombre || "", "s0"),
        cell(p.cargo || "", "s0"),
        cell(p.dni || "", "s0"),
        cell(p.registro || "", "s0"),
        cell(num(p.meses), "sMoney", "Number"),
        cell(p.contrato || "", "s0"),
      ),
    );

    return `
    <Worksheet ss:Name="Personal">
      <Table ss:DefaultColumnWidth="100">
        <Column ss:Width="40"/>
        <Column ss:Width="180"/>
        <Column ss:Width="150"/>
        <Column ss:Width="80"/>
        <Column ss:Width="100"/>
        <Column ss:Width="70"/>
        <Column ss:Width="220"/>
        ${encabezado.join("\n")}
        ${filas.join("\n")}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Hoja 5: Presupuesto analitico
  // -------------------------------------------------------------------------

  function hojaPresupuestoAnalitico(s) {
    const items = s.presupuestoAnalitico || [];
    const encabezado = [
      rowH(
        30,
        cellMerge(
          `PRESUPUESTO ANALITICO MODIFICADO Y EJECUCION | ${(s.proyecto || {}).nombre || ""}`,
          6,
          "sTitulo",
        ),
      ),
      row(
        cellMerge(
          `CUI: ${(s.proyecto || {}).cui || ""} | Directiva 017-2023-CG`,
          6,
          "sSubtitulo",
        ),
      ),
      spacerRow(7),
      row(
        cell("N°", "sHeader"),
        cell("ESPECIFICA GASTO", "sHeader"),
        cell("DESCRIPCION", "sHeader"),
        cell("PPTO. MODIFICADO (S/)", "sHeader"),
        cell("EJECUTADO MES (S/)", "sHeader"),
        cell("EJECUTADO ACUMULADO (S/)", "sHeader"),
        cell("SALDO (S/)", "sHeader"),
      ),
    ];
    let totalPresup = 0;
    let totalMes = 0;
    let totalAcum = 0;
    const filas = items.map((it, i) => {
      const saldo =
        num(it.presupuestoModificado) - num(it.ejecutadoAcumulado);
      totalPresup += num(it.presupuestoModificado);
      totalMes += num(it.ejecutadoMes);
      totalAcum += num(it.ejecutadoAcumulado);
      return row(
        cell(i + 1, "s0", "Number"),
        cell(it.especifica || "", "s0"),
        cell(it.descripcion || "", "s0"),
        cell(num(it.presupuestoModificado), "sMoney", "Number"),
        cell(num(it.ejecutadoMes), "sMoney", "Number"),
        cell(num(it.ejecutadoAcumulado), "sMoney", "Number"),
        cell(saldo, "sMoney", "Number"),
      );
    });
    const totalRow = row(
      cellMerge("TOTAL", 2, "sTotalLabel"),
      emptyCell(1),
      cell(totalPresup, "sTotal", "Number"),
      cell(totalMes, "sTotal", "Number"),
      cell(totalAcum, "sTotal", "Number"),
      cell(totalPresup - totalAcum, "sTotal", "Number"),
    );

    return `
    <Worksheet ss:Name="Pres.Analitico">
      <Table ss:DefaultColumnWidth="100">
        <Column ss:Width="40"/>
        <Column ss:Width="120"/>
        <Column ss:Width="220"/>
        <Column ss:Width="130"/>
        <Column ss:Width="110"/>
        <Column ss:Width="130"/>
        <Column ss:Width="110"/>
        ${encabezado.join("\n")}
        ${filas.join("\n")}
        ${totalRow}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Hoja 6: Control normativo Directiva 017-2023-CG
  // -------------------------------------------------------------------------

  function hojaControlNormativo(s) {
    const checklistBase = [
      "Informe mensual de supervision y valorizacion presentado",
      "Valorizacion formulada con metrados realmente ejecutados",
      "Comparacion programado vs ejecutado (cronograma comparado)",
      "Curva S fisica y financiera incluida",
      "Control fisico-financiero documentado",
      "Control de personal propuesto y presente en obra",
      "Modificaciones al expediente tecnico registradas",
      "Presupuesto analitico y ejecucion de gasto actualizado",
      "Cuaderno de obra actualizado y correlativo",
      "Panel fotografico incluido",
      "Especificaciones tecnicas cumplidas",
      "Planos de obra compatibles con ejecucion",
      "Metrados diarios sustentados en planillas",
      "Reajustes verificados (formula polinomica si aplica)",
      "Riesgos identificados y reportados",
    ];

    const controles = s.controlNormativo || [];

    const encabezado = [
      rowH(
        30,
        cellMerge(
          `CONTROL NORMATIVO - DIRECTIVA 017-2023-CG | ${(s.proyecto || {}).nombre || ""}`,
          4,
          "sTitulo",
        ),
      ),
      row(
        cellMerge(
          `CUI: ${(s.proyecto || {}).cui || ""}`,
          4,
          "sSubtitulo",
        ),
      ),
      spacerRow(5),
      row(
        cell("N°", "sHeader"),
        cell("REQUISITO NORMATIVO", "sHeader"),
        cell("ESTADO", "sHeader"),
        cell("EVIDENCIA / OBSERVACION", "sHeader"),
      ),
    ];

    const filas = checklistBase.map((requisito, i) => {
      const ctrl = controles.find((c) => c.item === i) || {};
      const estado = ctrl.estado || "Pendiente";
      const evidencia = ctrl.evidencia || "";
      const estiloEstado =
        estado === "Cumple"
          ? "sCheckOk"
          : estado === "Observado"
            ? "sCheckObs"
            : "sCheckNa";
      return row(
        cell(i + 1, "s0", "Number"),
        cell(requisito, "s0"),
        cell(estado, estiloEstado),
        cell(evidencia, "s0"),
      );
    });

    return `
    <Worksheet ss:Name="Control 017">
      <Table ss:DefaultColumnWidth="120">
        <Column ss:Width="40"/>
        <Column ss:Width="300"/>
        <Column ss:Width="100"/>
        <Column ss:Width="300"/>
        ${encabezado.join("\n")}
        ${filas.join("\n")}
      </Table>
    </Worksheet>`;
  }

  // -------------------------------------------------------------------------
  // Funcion principal de exportacion
  // -------------------------------------------------------------------------

  function exportarExcel(estado) {
    const valorizaciones = estado.valorizaciones || [];

    const hojas = [
      hojaPortada(estado),
      ...valorizaciones.map((_, i) => hojaValorizacion(estado, i)),
      hojaCronograma(estado),
      hojaPersonal(estado),
      hojaPresupuestoAnalitico(estado),
      hojaControlNormativo(estado),
    ].filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Valorizacion de Obra - Directiva 017-2023-CG</Title>
    <Author>${esc((estado.proyecto || {}).supervisor?.nombre || "Sistema")}</Author>
  </DocumentProperties>
  ${STYLES}
  ${hojas.join("\n")}
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=UTF-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const proyecto = (estado.proyecto || {}).nombre || "obra";
    const cui = (estado.proyecto || {}).cui || "";
    const safeName = `${cui ? cui + "_" : ""}valorizacion`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    a.href = url;
    a.download = `${safeName}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  globalThis.valorizacionExport = { exportarExcel };
})();
