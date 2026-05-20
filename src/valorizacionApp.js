// Aplicacion principal de valorizacion automatica - Directiva 017-2023-CG
// Estado gestionado en memoria con persistencia en localStorage.

(function () {
  "use strict";

  const {
    calcPresupuesto,
    calcValorizacion,
    calcCurvaS,
    calcCronogramaAcumulados,
    fmtMoneda,
    fmtPct,
    getBrechaCondicion,
    roundMoney,
  } = globalThis.valorizacionLogic;

  const { exportarExcel } = globalThis.valorizacionExport;

  const STORAGE_KEY = "val017_2023_estado";

  // -------------------------------------------------------------------------
  // Estado inicial
  // -------------------------------------------------------------------------

  function defaultEstado() {
    return {
      panelActivo: "proyecto",
      valActiva: 0,
      proyecto: {
        entidad: "",
        area: "",
        unidad: "",
        nombre: "",
        cui: "",
        modalidad: "Administracion directa",
        sector: "",
        departamento: "",
        provincia: "",
        distrito: "",
        localidad: "",
        fuenteFinanciamiento: "",
        documentoAprobacion: "",
        fechaAprobacion: "",
        supervisor: { nombre: "", registro: "", dni: "" },
        residente: { nombre: "", registro: "", dni: "" },
      },
      cronograma: {
        fechaInicio: "",
        plazoAprobado: 0,
        meses: [],
      },
      presupuesto: {
        partidas: [],
        pctGastosGenerales: 0,
        pctSupervision: 0,
        montoLiquidacion: 0,
        montoExpediente: 0,
      },
      valorizaciones: [],
      personal: [],
      presupuestoAnalitico: [],
      controlNormativo: [],
    };
  }

  // -------------------------------------------------------------------------
  // Persistencia
  // -------------------------------------------------------------------------

  function cargarEstado() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign(defaultEstado(), parsed);
      }
    } catch (_) {
      // ignore
    }
    return defaultEstado();
  }

  function guardarEstado() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (_) {
      // ignore
    }
  }

  // -------------------------------------------------------------------------
  // UID simple
  // -------------------------------------------------------------------------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // -------------------------------------------------------------------------
  // Escape HTML
  // -------------------------------------------------------------------------

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function num(v) {
    return Number(v) || 0;
  }

  // -------------------------------------------------------------------------
  // Estado global
  // -------------------------------------------------------------------------

  let estado = cargarEstado();
  const app = document.querySelector("#vapp");

  // -------------------------------------------------------------------------
  // Componentes UI reutilizables
  // -------------------------------------------------------------------------

  function campo(label, name, value, tipo, extra) {
    return `
      <label class="vfield">
        <span>${esc(label)}</span>
        <input type="${tipo || "text"}" data-field="${esc(name)}"
          value="${esc(value)}" ${extra || ""}/>
      </label>`;
  }

  function campoNum(label, name, value, extra) {
    return `
      <label class="vfield">
        <span>${esc(label)}</span>
        <input type="number" step="any" data-field="${esc(name)}"
          value="${esc(value)}" ${extra || ""}/>
      </label>`;
  }

  function tablaVacia(cols, mensaje) {
    return `<tr><td colspan="${cols}" class="vempty">${esc(mensaje)}</td></tr>`;
  }

  // -------------------------------------------------------------------------
  // Renderizado principal
  // -------------------------------------------------------------------------

  function render() {
    app.innerHTML = `
      ${renderHero()}
      ${renderToolbar()}
      <main class="vapp-main">
        ${renderPanelProyecto()}
        ${renderPanelPresupuesto()}
        ${renderPanelValorizacion()}
        ${renderPanelCronograma()}
        ${renderPanelPersonal()}
        ${renderPanelPresupuestoAnalitico()}
        ${renderPanelResumen()}
      </main>`;
    activarPanel(estado.panelActivo);
    wireEvents();
  }

  // -------------------------------------------------------------------------
  // Hero
  // -------------------------------------------------------------------------

  function renderHero() {
    const p = estado.proyecto;
    const vals = estado.valorizaciones;
    const valIdx = Math.max(0, Math.min(estado.valActiva, vals.length - 1));
    let avanceFisico = 0;
    let avanceFinanciero = 0;
    let brechaTexto = "Sin valorizaciones";
    let brechaNivel = "neutral";

    if (vals.length > 0) {
      const vc = calcValorizacion(valIdx, vals, estado.presupuesto);
      avanceFisico = vc.avanceFisicoAcum;
      avanceFinanciero = vc.avanceFinancieroAcum;
      const progMes = vals[valIdx]?.programadoAcumPct || 0;
      const condicion = getBrechaCondicion(avanceFisico - progMes);
      brechaTexto = condicion.texto;
      brechaNivel = condicion.nivel;
    }

    return `
    <header class="hero">
      <div class="hero-content">
        <span class="eyebrow">Directiva 017-2023-CG | ${esc(p.modalidad || "Administracion directa")}</span>
        <h1>Valorizacion automatica de obra</h1>
        <p>${esc(p.nombre || "Complete los datos del proyecto para comenzar")}</p>
        <div class="hero-meta">
          ${p.entidad ? `<span>${esc(p.entidad)}</span>` : ""}
          ${p.cui ? `<span>CUI ${esc(p.cui)}</span>` : ""}
          ${vals.length > 0 ? `<span>${vals.length} valoriz. registradas</span>` : ""}
        </div>
      </div>
      <div class="hero-status ${brechaNivel}">
        <span>Estado de avance</span>
        <strong>${esc(brechaTexto)}</strong>
        <small>Fisico: ${fmtPct(avanceFisico)}</small>
        <small>Financiero: ${fmtPct(avanceFinanciero)}</small>
      </div>
    </header>`;
  }

  // -------------------------------------------------------------------------
  // Toolbar
  // -------------------------------------------------------------------------

  function renderToolbar() {
    const tabs = [
      ["proyecto", "Proyecto"],
      ["presupuesto", "Presupuesto"],
      ["valorizacion", "Valorizacion"],
      ["cronograma", "Cronograma"],
      ["personal", "Personal"],
      ["presup-analitico", "Pres. Analitico"],
      ["resumen", "Resumen"],
    ];

    return `
    <section class="toolbar vtoolbar">
      <nav class="tabs" aria-label="Secciones">
        ${tabs.map(([id, label]) => `
          <button class="${estado.panelActivo === id ? "active" : ""}"
            data-panel-target="${id}">${esc(label)}</button>`).join("")}
      </nav>
      <div class="vactions">
        <button class="button ghost" id="btnNuevaVal" title="Agregar nueva valorizacion mensual">+ Nueva val.</button>
        <button class="button ghost" id="btnGuardarJson" title="Guardar proyecto como JSON">Guardar JSON</button>
        <label class="button ghost" title="Cargar proyecto desde JSON">
          Cargar JSON
          <input type="file" id="inputCargarJson" accept=".json" style="display:none">
        </label>
        <button class="button primary" id="btnExportarExcel" title="Exportar todo a Excel">Exportar Excel</button>
      </div>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Proyecto
  // -------------------------------------------------------------------------

  function renderPanelProyecto() {
    const p = estado.proyecto;
    return `
    <section class="vpanel" id="panel-proyecto">
      <div class="grid two">
        <article class="card">
          <h2>Datos de la entidad</h2>
          <div class="vform">
            ${campo("Entidad ejecutora", "proyecto.entidad", p.entidad)}
            ${campo("Area / Gerencia", "proyecto.area", p.area)}
            ${campo("Unidad funcional", "proyecto.unidad", p.unidad)}
          </div>
        </article>
        <article class="card">
          <h2>Datos del proyecto</h2>
          <div class="vform">
            ${campo("Nombre del proyecto / IOARR", "proyecto.nombre", p.nombre)}
            ${campo("CUI", "proyecto.cui", p.cui)}
            ${campo("Modalidad", "proyecto.modalidad", p.modalidad)}
            ${campo("Sector", "proyecto.sector", p.sector)}
          </div>
        </article>
      </div>
      <div class="grid two">
        <article class="card">
          <h2>Ubicacion</h2>
          <div class="vform vform-4">
            ${campo("Departamento", "proyecto.departamento", p.departamento)}
            ${campo("Provincia", "proyecto.provincia", p.provincia)}
            ${campo("Distrito", "proyecto.distrito", p.distrito)}
            ${campo("Localidad / Centro poblado", "proyecto.localidad", p.localidad)}
          </div>
        </article>
        <article class="card">
          <h2>Marco normativo</h2>
          <div class="vform">
            ${campo("Fuente de financiamiento", "proyecto.fuenteFinanciamiento", p.fuenteFinanciamiento)}
            ${campo("Documento de aprobacion", "proyecto.documentoAprobacion", p.documentoAprobacion)}
            ${campo("Fecha de aprobacion", "proyecto.fechaAprobacion", p.fechaAprobacion, "date")}
          </div>
        </article>
      </div>
      <div class="grid two">
        <article class="card">
          <h2>Supervisor de obra</h2>
          <div class="vform">
            ${campo("Nombre y apellidos", "proyecto.supervisor.nombre", p.supervisor.nombre)}
            ${campo("N° registro (CIP/CMV/otro)", "proyecto.supervisor.registro", p.supervisor.registro)}
            ${campo("DNI", "proyecto.supervisor.dni", p.supervisor.dni)}
          </div>
        </article>
        <article class="card">
          <h2>Residente de obra</h2>
          <div class="vform">
            ${campo("Nombre y apellidos", "proyecto.residente.nombre", p.residente.nombre)}
            ${campo("N° registro (CIP/CMV/otro)", "proyecto.residente.registro", p.residente.registro)}
            ${campo("DNI", "proyecto.residente.dni", p.residente.dni)}
          </div>
        </article>
      </div>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Presupuesto
  // -------------------------------------------------------------------------

  function renderPanelPresupuesto() {
    const pr = estado.presupuesto;
    const presCalc = calcPresupuesto(pr);

    const filas = presCalc.partidasCalc.length
      ? presCalc.partidasCalc.map((p) => `
          <tr>
            <td><input data-rowpres="${esc(p.id)}" data-col="codigo" value="${esc(p.codigo)}" size="8"/></td>
            <td><input data-rowpres="${esc(p.id)}" data-col="descripcion" value="${esc(p.descripcion)}" class="wide"/></td>
            <td><input data-rowpres="${esc(p.id)}" data-col="und" value="${esc(p.und)}" size="5"/></td>
            <td><input type="number" step="any" data-rowpres="${esc(p.id)}" data-col="metrado" value="${esc(p.metrado)}" size="7"/></td>
            <td><input type="number" step="any" data-rowpres="${esc(p.id)}" data-col="precioUnitario" value="${esc(p.precioUnitario)}" size="9"/></td>
            <td class="vcalc">${fmtMoneda(p.parcial)}</td>
            <td>
              <select data-rowpres="${esc(p.id)}" data-col="tipo">
                <option value="directo" ${p.tipo === "directo" ? "selected" : ""}>Costo directo</option>
                <option value="otro" ${p.tipo === "otro" ? "selected" : ""}>Otro</option>
              </select>
            </td>
            <td>
              <button class="vbtn-del" data-del-pres="${esc(p.id)}" title="Eliminar partida">✕</button>
            </td>
          </tr>`).join("")
      : tablaVacia(8, "Sin partidas. Agregue partidas del expediente tecnico.");

    return `
    <section class="vpanel" id="panel-presupuesto">
      <div class="section-head">
        <div>
          <h2>Presupuesto base (expediente tecnico)</h2>
          <p>Ingrese las partidas del costo directo. Los importes se calculan automaticamente.</p>
        </div>
        <button class="button primary" id="btnAgregarPartida">+ Agregar partida</button>
      </div>
      <article class="card vtable-card">
        <div class="table-wrap">
          <table id="tblPresupuesto">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th>Und.</th>
                <th>Metrado Exp.</th>
                <th>P.U. (S/)</th>
                <th>Parcial (S/) <em class="vcalc-badge">auto</em></th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="tbodyPresupuesto">${filas}</tbody>
          </table>
        </div>
      </article>
      <div class="grid two">
        <article class="card">
          <h2>Costos indirectos</h2>
          <div class="vform vform-2">
            ${campoNum("Gastos generales (%)", "presupuesto.pctGastosGenerales", pr.pctGastosGenerales)}
            ${campoNum("Gastos de supervision (%)", "presupuesto.pctSupervision", pr.pctSupervision)}
            ${campoNum("Gastos de liquidacion (S/)", "presupuesto.montoLiquidacion", pr.montoLiquidacion)}
            ${campoNum("Elaboracion de expediente tecnico (S/)", "presupuesto.montoExpediente", pr.montoExpediente)}
          </div>
        </article>
        <article class="card">
          <h2>Resumen presupuestario</h2>
          <dl class="facts">
            <div><dt>Costo directo</dt><dd><strong>${fmtMoneda(presCalc.costoDirecto)}</strong></dd></div>
            <div><dt>Gastos generales (${fmtPct(presCalc.pctGG)})</dt><dd>${fmtMoneda(presCalc.gastosGenerales)}</dd></div>
            <div><dt>Supervision (${fmtPct(presCalc.pctSup)})</dt><dd>${fmtMoneda(presCalc.supervision)}</dd></div>
            <div><dt>Total presupuesto de obra</dt><dd><strong>${fmtMoneda(presCalc.totalObra)}</strong></dd></div>
            <div><dt>Liquidacion</dt><dd>${fmtMoneda(presCalc.liquidacion)}</dd></div>
            <div><dt>Expediente tecnico</dt><dd>${fmtMoneda(presCalc.expediente)}</dd></div>
            <div><dt>Inversion total</dt><dd><strong class="vtotal">${fmtMoneda(presCalc.totalInversion)}</strong></dd></div>
          </dl>
        </article>
      </div>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Valorizacion mensual
  // -------------------------------------------------------------------------

  function renderPanelValorizacion() {
    const vals = estado.valorizaciones;
    const presCalc = calcPresupuesto(estado.presupuesto);

    if (presCalc.partidasCalc.length === 0) {
      return `
      <section class="vpanel" id="panel-valorizacion">
        <article class="card">
          <div class="alert warning">
            Para crear una valorizacion primero registre las partidas del presupuesto en la pestana <strong>Presupuesto</strong>.
          </div>
        </article>
      </section>`;
    }

    if (vals.length === 0) {
      return `
      <section class="vpanel" id="panel-valorizacion">
        <article class="card">
          <div class="alert neutral">
            No hay valorizaciones registradas.
            Use el boton <strong>+ Nueva val.</strong> en la barra superior para agregar la primera valorizacion mensual.
          </div>
        </article>
      </section>`;
    }

    const valIdx = Math.max(0, Math.min(estado.valActiva, vals.length - 1));
    const val = vals[valIdx];
    const vc = calcValorizacion(valIdx, vals, estado.presupuesto);

    const tabsVal = vals.map((v, i) => `
      <button class="${i === valIdx ? "active" : ""}" data-val-target="${i}">
        Val. N° ${i + 1}${v.periodo ? " | " + v.periodo : ""}
      </button>`).join("");

    const filasCd = vc.itemsCalc
      .filter((it) => it.tipo === "directo")
      .map((it) => `
        <tr>
          <td>${esc(it.codigo || "")}</td>
          <td>${esc(it.descripcion || "")}</td>
          <td>${esc(it.und || "")}</td>
          <td class="vcalc">${num(it.metrado)}</td>
          <td class="vcalc">${fmtMoneda(it.precioUnitario)}</td>
          <td class="vcalc">${fmtMoneda(it.parcial)}</td>
          <td>
            <input type="number" step="any" class="vinput-metrado"
              data-val-item="${esc(it.id)}"
              value="${esc(it.metradoMes)}"
              placeholder="0"/>
          </td>
          <td class="vcalc">${fmtMoneda(it.importeMes)}</td>
          <td class="vcalc">${num(it.metradoAcum)}</td>
          <td class="vcalc">${fmtMoneda(it.importeAcum)}</td>
          <td class="vcalc">
            <div class="bar"><span style="width:${Math.min(it.avancePct, 100)}%"></span></div>
            ${fmtPct(it.avancePct)}
          </td>
        </tr>`);

    const brechaProgMes = num(val.programadoAcumPct);
    const brechaFisica = vc.avanceFisicoAcum - brechaProgMes;
    const condicion = getBrechaCondicion(brechaFisica);

    return `
    <section class="vpanel" id="panel-valorizacion">
      <div class="section-head">
        <div>
          <h2>Valorizacion mensual de obra</h2>
          <p>Ingrese los metrados ejecutados en el mes. Los importes y avances se calculan automaticamente.</p>
        </div>
        <div class="segmented">${tabsVal}</div>
      </div>
      <div class="grid two">
        <article class="card">
          <h3>Datos de la valorizacion N° ${valIdx + 1}</h3>
          <div class="vform vform-2">
            ${campo("Periodo (ej: Abril 2026)", `val.${valIdx}.periodo`, val.periodo || "")}
            ${campo("Fecha inicio", `val.${valIdx}.fechaInicio`, val.fechaInicio || "", "date")}
            ${campo("Fecha fin", `val.${valIdx}.fechaFin`, val.fechaFin || "", "date")}
            ${campoNum("PIM vigente (S/)", `val.${valIdx}.pim`, val.pim || 0)}
            ${campoNum("Devengado del mes (S/)", `val.${valIdx}.devengado`, val.devengado || 0)}
            ${campoNum("% Programado acumulado", `val.${valIdx}.programadoAcumPct`, val.programadoAcumPct || 0)}
          </div>
          <button class="vbtn-del" data-del-val="${valIdx}"
            style="margin-top:0.8rem" title="Eliminar esta valorizacion">
            Eliminar valorizacion N° ${valIdx + 1}
          </button>
        </article>
        <article class="card">
          <h3>Indicadores del periodo</h3>
          <div class="totals stacked">
            <article class="kpi">
              <span>Avance fisico acum. CD</span>
              <strong>${fmtPct(vc.avanceFisicoAcum)}</strong>
              <small>${fmtMoneda(vc.cdAcum)} de ${fmtMoneda(vc.presCalc.costoDirecto)}</small>
            </article>
            <article class="kpi ${condicion.nivel === "danger" ? "kdanger" : condicion.nivel === "warning" ? "kwarning" : ""}">
              <span>Avance financiero acum.</span>
              <strong>${fmtPct(vc.avanceFinancieroAcum)}</strong>
              <small>Devengado acum.: ${fmtMoneda(vc.devengadoAcum)}</small>
            </article>
          </div>
          <div class="alert ${condicion.nivel}" style="margin-top:0.8rem">
            Condicion: <strong>${esc(condicion.texto)}</strong>.
            Brecha fisica: ${fmtPct(brechaFisica)}.
            Programado acumulado: ${fmtPct(brechaProgMes)}.
          </div>
        </article>
      </div>
      <article class="card vtable-card">
        <h3>Partidas del costo directo</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th>Und</th>
                <th>Metrado<br>Exp.</th>
                <th>P.U. (S/)</th>
                <th>Parcial Exp.<br>(S/)</th>
                <th>Metrado<br>Mes <em class="vcalc-badge">ingresar</em></th>
                <th>Importe<br>Mes (S/) <em class="vcalc-badge">auto</em></th>
                <th>Metrado<br>Acum.</th>
                <th>Importe<br>Acum. (S/)</th>
                <th>Avance %</th>
              </tr>
            </thead>
            <tbody>${filasCd.join("") || tablaVacia(11, "Agregue partidas en Presupuesto primero.")}</tbody>
          </table>
        </div>
      </article>
      <div class="grid two">
        <article class="card">
          <h3>Resumen de valorizacion</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Presupuesto</th>
                  <th>Val. Mes</th>
                  <th>Val. Acum.</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Costo directo</td>
                  <td>${fmtMoneda(vc.presCalc.costoDirecto)}</td>
                  <td>${fmtMoneda(vc.cdMes)}</td>
                  <td>${fmtMoneda(vc.cdAcum)}</td>
                  <td>${fmtMoneda(vc.saldoCostoDirecto)}</td>
                </tr>
                <tr>
                  <td>Gastos generales (${fmtPct(vc.presCalc.pctGG)})</td>
                  <td>${fmtMoneda(vc.presCalc.gastosGenerales)}</td>
                  <td>${fmtMoneda(vc.ggMes)}</td>
                  <td>${fmtMoneda(vc.ggAcum)}</td>
                  <td>${fmtMoneda(roundMoney(vc.presCalc.gastosGenerales - vc.ggAcum))}</td>
                </tr>
                <tr>
                  <td>Supervision (${fmtPct(vc.presCalc.pctSup)})</td>
                  <td>${fmtMoneda(vc.presCalc.supervision)}</td>
                  <td>${fmtMoneda(vc.supMes)}</td>
                  <td>${fmtMoneda(vc.supAcum)}</td>
                  <td>${fmtMoneda(roundMoney(vc.presCalc.supervision - vc.supAcum))}</td>
                </tr>
                <tr class="vtotal-row">
                  <td><strong>Total pres. de obra</strong></td>
                  <td><strong>${fmtMoneda(vc.presCalc.totalObra)}</strong></td>
                  <td><strong>${fmtMoneda(vc.totalMes)}</strong></td>
                  <td><strong>${fmtMoneda(vc.totalAcum)}</strong></td>
                  <td><strong>${fmtMoneda(vc.saldoObra)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="card">
          <h3>Ejecucion financiera del periodo</h3>
          <dl class="facts">
            <div><dt>PIM vigente</dt><dd>${fmtMoneda(vc.pimVigente)}</dd></div>
            <div><dt>Devengado del mes</dt><dd>${fmtMoneda(vc.devengadoMes)}</dd></div>
            <div><dt>Devengado acumulado</dt><dd><strong>${fmtMoneda(vc.devengadoAcum)}</strong></dd></div>
            <div><dt>Avance financiero acum.</dt><dd><strong>${fmtPct(vc.avanceFinancieroAcum)}</strong></dd></div>
          </dl>
        </article>
      </div>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Cronograma
  // -------------------------------------------------------------------------

  function renderPanelCronograma() {
    const cr = estado.cronograma;
    const mesesCalc = calcCronogramaAcumulados(cr.meses);
    const curvaS = calcCurvaS(cr, estado.valorizaciones, estado.presupuesto);

    const filasMeses = mesesCalc.length
      ? mesesCalc.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><input data-rowcron="${i}" data-col="descripcion" value="${esc(m.descripcion || "")}" class="wide"/></td>
            <td><input type="number" step="any" data-rowcron="${i}" data-col="porcentajeMensual" value="${esc(m.porcentajeMensual || 0)}"/></td>
            <td class="vcalc">${fmtPct(m.porcentajeAcumulado)}</td>
            <td class="vcalc">${curvaS[i] ? fmtPct(curvaS[i].fisicoAcumPct) : "—"}</td>
            <td class="vcalc">${curvaS[i] ? fmtPct(curvaS[i].financieroAcumPct) : "—"}</td>
            <td>
              <button class="vbtn-del" data-del-cron="${i}" title="Eliminar mes">✕</button>
            </td>
          </tr>`).join("")
      : tablaVacia(7, "Agregue periodos al cronograma.");

    return `
    <section class="vpanel" id="panel-cronograma">
      <div class="section-head">
        <div>
          <h2>Cronograma comparado</h2>
          <p>Defina los periodos y porcentajes programados. Los avances fisico y financiero se actualizan automaticamente.</p>
        </div>
        <button class="button primary" id="btnAgregarMes">+ Agregar mes</button>
      </div>
      <div class="grid two" style="margin-bottom:1rem">
        <article class="card">
          <div class="vform vform-2">
            ${campo("Fecha de inicio de obra", "cronograma.fechaInicio", cr.fechaInicio || "", "date")}
            ${campoNum("Plazo aprobado (dias calendario)", "cronograma.plazoAprobado", cr.plazoAprobado || 0)}
          </div>
        </article>
        <article class="card">
          <p class="muted">El avance fisico acumulado se calcula automaticamente en base a las valorizaciones ingresadas en la pestana <strong>Valorizacion</strong>. Solo ingrese los porcentajes programados por periodo.</p>
        </article>
      </div>
      <article class="card vtable-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Periodo</th>
                <th>% Programado mensual</th>
                <th>% Programado acum. <em class="vcalc-badge">auto</em></th>
                <th>% Fisico acum. <em class="vcalc-badge">auto</em></th>
                <th>% Financiero acum. <em class="vcalc-badge">auto</em></th>
                <th></th>
              </tr>
            </thead>
            <tbody>${filasMeses}</tbody>
          </table>
        </div>
      </article>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Personal
  // -------------------------------------------------------------------------

  function renderPanelPersonal() {
    const personal = estado.personal;
    const filas = personal.length
      ? personal.map((p, i) => `
          <tr>
            <td><input data-rowpers="${i}" data-col="nombre" value="${esc(p.nombre || "")}" class="wide"/></td>
            <td><input data-rowpers="${i}" data-col="cargo" value="${esc(p.cargo || "")}" class="wide"/></td>
            <td><input data-rowpers="${i}" data-col="dni" value="${esc(p.dni || "")}" size="9"/></td>
            <td><input data-rowpers="${i}" data-col="registro" value="${esc(p.registro || "")}"/></td>
            <td><input type="number" step="0.01" data-rowpers="${i}" data-col="meses" value="${esc(p.meses || 0)}" size="5"/></td>
            <td><input data-rowpers="${i}" data-col="contrato" value="${esc(p.contrato || "")}" class="wide"/></td>
            <td>
              <button class="vbtn-del" data-del-pers="${i}" title="Eliminar">✕</button>
            </td>
          </tr>`).join("")
      : tablaVacia(7, "Agregue el personal asignado a la obra.");

    return `
    <section class="vpanel" id="panel-personal">
      <div class="section-head">
        <div>
          <h2>Personal propuesto y presente</h2>
          <p>Registro del equipo tecnico y administrativo segun Directiva 017-2023-CG.</p>
        </div>
        <button class="button primary" id="btnAgregarPersonal">+ Agregar personal</button>
      </div>
      <article class="card vtable-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre y apellidos</th>
                <th>Cargo / Rol</th>
                <th>DNI</th>
                <th>N° Registro</th>
                <th>Meses</th>
                <th>Doc. vinculacion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </article>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Presupuesto analitico
  // -------------------------------------------------------------------------

  function renderPanelPresupuestoAnalitico() {
    const items = estado.presupuestoAnalitico;
    let totalPresup = 0;
    let totalMes = 0;
    let totalAcum = 0;
    const filas = items.length
      ? items.map((it, i) => {
          const saldo = roundMoney(num(it.presupuestoModificado) - num(it.ejecutadoAcumulado));
          totalPresup = roundMoney(totalPresup + num(it.presupuestoModificado));
          totalMes = roundMoney(totalMes + num(it.ejecutadoMes));
          totalAcum = roundMoney(totalAcum + num(it.ejecutadoAcumulado));
          return `
          <tr>
            <td><input data-rowpa="${i}" data-col="especifica" value="${esc(it.especifica || "")}" size="10"/></td>
            <td><input data-rowpa="${i}" data-col="descripcion" value="${esc(it.descripcion || "")}" class="wide"/></td>
            <td><input type="number" step="any" data-rowpa="${i}" data-col="presupuestoModificado" value="${esc(it.presupuestoModificado || 0)}"/></td>
            <td><input type="number" step="any" data-rowpa="${i}" data-col="ejecutadoMes" value="${esc(it.ejecutadoMes || 0)}"/></td>
            <td><input type="number" step="any" data-rowpa="${i}" data-col="ejecutadoAcumulado" value="${esc(it.ejecutadoAcumulado || 0)}"/></td>
            <td class="vcalc">${fmtMoneda(saldo)}</td>
            <td><button class="vbtn-del" data-del-pa="${i}" title="Eliminar">✕</button></td>
          </tr>`;
        }).join("")
      : tablaVacia(7, "Ingrese las especificas del gasto segun el presupuesto analitico.");

    const totalRow = items.length ? `
      <tr class="vtotal-row">
        <td colspan="2"><strong>TOTAL</strong></td>
        <td><strong>${fmtMoneda(totalPresup)}</strong></td>
        <td><strong>${fmtMoneda(totalMes)}</strong></td>
        <td><strong>${fmtMoneda(totalAcum)}</strong></td>
        <td><strong>${fmtMoneda(roundMoney(totalPresup - totalAcum))}</strong></td>
        <td></td>
      </tr>` : "";

    return `
    <section class="vpanel" id="panel-presup-analitico">
      <div class="section-head">
        <div>
          <h2>Presupuesto analitico modificado</h2>
          <p>Control de la ejecucion del gasto por especifica presupuestaria.</p>
        </div>
        <button class="button primary" id="btnAgregarPA">+ Agregar especifica</button>
      </div>
      <article class="card vtable-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Especifica (cadena)</th>
                <th>Descripcion</th>
                <th>Presup. Modificado (S/)</th>
                <th>Ejecutado Mes (S/)</th>
                <th>Ejecutado Acum. (S/)</th>
                <th>Saldo (S/) <em class="vcalc-badge">auto</em></th>
                <th></th>
              </tr>
            </thead>
            <tbody>${filas}${totalRow}</tbody>
          </table>
        </div>
      </article>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Panel: Resumen ejecutivo (solo lectura)
  // -------------------------------------------------------------------------

  function renderPanelResumen() {
    const vals = estado.valorizaciones;
    const presCalc = calcPresupuesto(estado.presupuesto);
    const curvaS = calcCurvaS(
      estado.cronograma,
      vals,
      estado.presupuesto,
    );

    if (vals.length === 0 || presCalc.partidasCalc.length === 0) {
      return `
      <section class="vpanel" id="panel-resumen">
        <article class="card">
          <div class="alert neutral">
            Complete los datos del <strong>Presupuesto</strong> y registre al menos una <strong>Valorizacion</strong> para ver el resumen ejecutivo.
          </div>
        </article>
      </section>`;
    }

    const valIdx = Math.max(0, Math.min(estado.valActiva, vals.length - 1));
    const vc = calcValorizacion(valIdx, vals, estado.presupuesto);
    const brechaFisica = vc.avanceFisicoAcum - num(vals[valIdx]?.programadoAcumPct);
    const condicion = getBrechaCondicion(brechaFisica);

    // Curva S SVG
    const svgCurvaS = renderCurvaSVG(curvaS);

    return `
    <section class="vpanel" id="panel-resumen">
      <div class="grid two">
        <article class="card">
          <h2>Estado general de la obra</h2>
          <dl class="facts">
            <div><dt>Proyecto</dt><dd>${esc((estado.proyecto || {}).nombre || "—")}</dd></div>
            <div><dt>CUI</dt><dd>${esc((estado.proyecto || {}).cui || "—")}</dd></div>
            <div><dt>Entidad</dt><dd>${esc((estado.proyecto || {}).entidad || "—")}</dd></div>
            <div><dt>Modalidad</dt><dd>${esc((estado.proyecto || {}).modalidad || "—")}</dd></div>
            <div><dt>Valorizacion activa</dt><dd>N° ${valIdx + 1}${vals[valIdx]?.periodo ? " | " + vals[valIdx].periodo : ""}</dd></div>
          </dl>
          <div class="alert ${condicion.nivel}" style="margin-top:0.8rem">
            Condicion: <strong>${esc(condicion.texto)}</strong> |
            Brecha fisica: ${fmtPct(brechaFisica)}
          </div>
        </article>
        <article class="card">
          <h2>Indicadores de avance (acumulados)</h2>
          <div class="rings">
            ${progressRing("Programado", num(vals[valIdx]?.programadoAcumPct), fmtPct(num(vals[valIdx]?.programadoAcumPct)), "programmed")}
            ${progressRing("Fisico CD", vc.avanceFisicoAcum, fmtMoneda(vc.cdAcum), "physical")}
            ${progressRing("Financiero", vc.avanceFinancieroAcum, fmtMoneda(vc.devengadoAcum), "financial")}
          </div>
        </article>
      </div>
      ${svgCurvaS}
      <div class="grid two">
        <article class="card">
          <h3>Resumen de valorizacion acumulada</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Presupuesto</th>
                  <th>Acumulado</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Costo directo</td><td>${fmtMoneda(vc.presCalc.costoDirecto)}</td><td>${fmtMoneda(vc.cdAcum)}</td><td>${fmtMoneda(vc.saldoCostoDirecto)}</td></tr>
                <tr><td>Gastos generales</td><td>${fmtMoneda(vc.presCalc.gastosGenerales)}</td><td>${fmtMoneda(vc.ggAcum)}</td><td>${fmtMoneda(roundMoney(vc.presCalc.gastosGenerales - vc.ggAcum))}</td></tr>
                <tr><td>Supervision</td><td>${fmtMoneda(vc.presCalc.supervision)}</td><td>${fmtMoneda(vc.supAcum)}</td><td>${fmtMoneda(roundMoney(vc.presCalc.supervision - vc.supAcum))}</td></tr>
                <tr class="vtotal-row"><td><strong>Total obra</strong></td><td><strong>${fmtMoneda(vc.presCalc.totalObra)}</strong></td><td><strong>${fmtMoneda(vc.totalAcum)}</strong></td><td><strong>${fmtMoneda(vc.saldoObra)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="card">
          <h3>Ejecucion financiera</h3>
          <dl class="facts">
            <div><dt>PIM vigente</dt><dd>${fmtMoneda(vc.pimVigente)}</dd></div>
            <div><dt>Devengado acumulado</dt><dd><strong>${fmtMoneda(vc.devengadoAcum)}</strong></dd></div>
            <div><dt>Avance financiero</dt><dd><strong>${fmtPct(vc.avanceFinancieroAcum)}</strong></dd></div>
            <div><dt>Inversion total aprobada</dt><dd>${fmtMoneda(vc.presCalc.totalInversion)}</dd></div>
          </dl>
          <button class="button primary" id="btnExportarExcel2" style="margin-top:1rem;width:100%">
            Exportar a Excel (todas las hojas)
          </button>
        </article>
      </div>
    </section>`;
  }

  // -------------------------------------------------------------------------
  // Curva S SVG
  // -------------------------------------------------------------------------

  function renderCurvaSVG(curvaS) {
    if (!curvaS || curvaS.length < 2) {
      return `<article class="card chart-card">
        <p class="muted">Agregue al menos 2 periodos en el Cronograma para visualizar la Curva S.</p>
      </article>`;
    }

    const W = 720;
    const H = 260;
    const PAD = 44;
    const yFn = (pct) => H - PAD - (Math.min(Math.max(pct, 0), 100) / 100) * (H - PAD * 2);
    const xStep = (W - PAD * 2) / (curvaS.length - 1);
    const pt = (i, pct) => `${PAD + i * xStep},${yFn(pct)}`;

    const progPoints = curvaS.map((m, i) => pt(i, m.programadoAcumPct)).join(" ");
    const fisicoPoints = curvaS.map((m, i) => pt(i, m.fisicoAcumPct)).join(" ");
    const financieroPoints = curvaS.map((m, i) => pt(i, m.financieroAcumPct)).join(" ");

    const ticks = [0, 25, 50, 75, 100].map((t) => `
      <line x1="${PAD}" y1="${yFn(t)}" x2="${W - PAD}" y2="${yFn(t)}" class="grid"></line>
      <text x="10" y="${yFn(t) + 4}">${t}%</text>`).join("");

    const xLabels = curvaS.map((m, i) => `
      <line x1="${PAD + i * xStep}" y1="${PAD}" x2="${PAD + i * xStep}" y2="${H - PAD}" class="grid vertical"></line>
      <text x="${PAD + i * xStep}" y="${H - 12}" text-anchor="middle">${esc(m.mes.split(" ")[0])}</text>`).join("");

    return `
    <article class="card chart-card">
      <div class="chart-title">
        <div>
          <h3>Curva S: programado vs ejecutado</h3>
          <p>Avance acumulado fisico (CD) y financiero (PIM) por periodo.</p>
        </div>
        <div class="legend">
          <span><i class="dot programmed"></i>Programado CD</span>
          <span><i class="dot physical"></i>Fisico CD</span>
          <span><i class="dot financial"></i>Financiero</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="line-chart" role="img" aria-label="Curva S de avance acumulado">
        ${ticks}${xLabels}
        <polyline points="${progPoints}" class="line programmed"></polyline>
        <polyline points="${fisicoPoints}" class="line physical"></polyline>
        <polyline points="${financieroPoints}" class="line financial"></polyline>
      </svg>
    </article>`;
  }

  // -------------------------------------------------------------------------
  // Progress ring (reutilizando logica del dashboard existente)
  // -------------------------------------------------------------------------

  function progressRing(label, percent, caption, variant) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(Math.max(percent, 0), 100) / 100) * circ;
    return `
    <article class="ring-card">
      <svg class="ring ${esc(variant)}" viewBox="0 0 130 130" role="img" aria-label="${esc(label)} ${fmtPct(percent)}">
        <circle class="ring-bg" cx="65" cy="65" r="${r}"></circle>
        <circle class="ring-value" cx="65" cy="65" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle>
        <text x="65" y="61" text-anchor="middle">${fmtPct(percent)}</text>
        <text x="65" y="79" text-anchor="middle">${esc(label)}</text>
      </svg>
      <p>${esc(caption)}</p>
    </article>`;
  }

  // -------------------------------------------------------------------------
  // Activar panel
  // -------------------------------------------------------------------------

  function activarPanel(panelId) {
    app.querySelectorAll(".vpanel").forEach((p) => p.classList.remove("active"));
    const panelEl = app.querySelector(`#panel-${panelId}`);
    if (panelEl) panelEl.classList.add("active");
  }

  // -------------------------------------------------------------------------
  // Setear valor anidado en objeto por ruta (ej: "proyecto.supervisor.nombre")
  // -------------------------------------------------------------------------

  function setNested(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    cur[last] = value;
  }

  function getNested(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  // -------------------------------------------------------------------------
  // Wire events
  // -------------------------------------------------------------------------

  function wireEvents() {
    // --- Tabs de navegacion ---
    app.querySelectorAll("[data-panel-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.panelActivo = btn.dataset.panelTarget;
        render();
      });
    });

    // --- Tabs de valorizacion ---
    app.querySelectorAll("[data-val-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.valActiva = parseInt(btn.dataset.valTarget, 10);
        render();
      });
    });

    // --- Inputs genericos de proyecto / presupuesto / cronograma ---
    app.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const path = input.dataset.field;

        // Campos de valorizacion dinamicos: val.INDEX.campo
        if (path.startsWith("val.")) {
          const parts = path.split(".");
          const idx = parseInt(parts[1], 10);
          const campo = parts.slice(2).join(".");
          if (!estado.valorizaciones[idx]) return;
          const raw = input.value;
          const isNum = input.type === "number";
          setNested(estado.valorizaciones[idx], campo, isNum ? (parseFloat(raw) || 0) : raw);
        } else {
          const raw = input.value;
          const isNum = input.type === "number";
          setNested(estado, path, isNum ? (parseFloat(raw) || 0) : raw);
        }
        guardarEstado();
        render();
      });
    });

    // --- Inputs de partidas del presupuesto ---
    app.querySelectorAll("[data-rowpres]").forEach((input) => {
      input.addEventListener("input", () => {
        const id = input.dataset.rowpres;
        const col = input.dataset.col;
        const partida = estado.presupuesto.partidas.find((p) => p.id === id);
        if (!partida) return;
        const isNum = input.type === "number";
        partida[col] = isNum ? (parseFloat(input.value) || 0) : input.value;
        guardarEstado();
        render();
      });
      if (input.tagName === "SELECT") {
        input.addEventListener("change", () => {
          const id = input.dataset.rowpres;
          const col = input.dataset.col;
          const partida = estado.presupuesto.partidas.find((p) => p.id === id);
          if (partida) {
            partida[col] = input.value;
            guardarEstado();
            render();
          }
        });
      }
    });

    // --- Inputs de metrado en valorizacion ---
    app.querySelectorAll(".vinput-metrado").forEach((input) => {
      input.addEventListener("input", () => {
        const idPartida = input.dataset.valItem;
        const valIdx = Math.max(0, Math.min(estado.valActiva, estado.valorizaciones.length - 1));
        const val = estado.valorizaciones[valIdx];
        if (!val) return;
        if (!val.items) val.items = [];
        let item = val.items.find((i) => i.idPartida === idPartida);
        if (!item) {
          item = { idPartida };
          val.items.push(item);
        }
        item.metradoMes = parseFloat(input.value) || 0;
        guardarEstado();
        render();
      });
    });

    // --- Inputs de cronograma ---
    app.querySelectorAll("[data-rowcron]").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.rowcron, 10);
        const col = input.dataset.col;
        if (!estado.cronograma.meses[idx]) return;
        const isNum = input.type === "number";
        estado.cronograma.meses[idx][col] = isNum
          ? (parseFloat(input.value) || 0)
          : input.value;
        guardarEstado();
        render();
      });
    });

    // --- Inputs de personal ---
    app.querySelectorAll("[data-rowpers]").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.rowpers, 10);
        const col = input.dataset.col;
        if (!estado.personal[idx]) return;
        const isNum = input.type === "number";
        estado.personal[idx][col] = isNum ? (parseFloat(input.value) || 0) : input.value;
        guardarEstado();
        render();
      });
    });

    // --- Inputs de presupuesto analitico ---
    app.querySelectorAll("[data-rowpa]").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.rowpa, 10);
        const col = input.dataset.col;
        if (!estado.presupuestoAnalitico[idx]) return;
        const isNum = input.type === "number";
        estado.presupuestoAnalitico[idx][col] = isNum
          ? (parseFloat(input.value) || 0)
          : input.value;
        guardarEstado();
        render();
      });
    });

    // --- Boton: Agregar partida ---
    const btnAgregarPartida = app.querySelector("#btnAgregarPartida");
    if (btnAgregarPartida) {
      btnAgregarPartida.addEventListener("click", () => {
        estado.presupuesto.partidas.push({
          id: uid(),
          codigo: "",
          descripcion: "",
          und: "",
          metrado: 0,
          precioUnitario: 0,
          tipo: "directo",
        });
        guardarEstado();
        render();
      });
    }

    // --- Boton: Eliminar partida ---
    app.querySelectorAll("[data-del-pres]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.delPres;
        estado.presupuesto.partidas = estado.presupuesto.partidas.filter((p) => p.id !== id);
        guardarEstado();
        render();
      });
    });

    // --- Boton: Agregar mes al cronograma ---
    const btnAgregarMes = app.querySelector("#btnAgregarMes");
    if (btnAgregarMes) {
      btnAgregarMes.addEventListener("click", () => {
        const n = estado.cronograma.meses.length + 1;
        estado.cronograma.meses.push({
          descripcion: `Mes ${n}`,
          porcentajeMensual: 0,
        });
        guardarEstado();
        render();
      });
    }

    // --- Boton: Eliminar mes ---
    app.querySelectorAll("[data-del-cron]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.delCron, 10);
        estado.cronograma.meses.splice(idx, 1);
        guardarEstado();
        render();
      });
    });

    // --- Boton: Agregar personal ---
    const btnAgregarPersonal = app.querySelector("#btnAgregarPersonal");
    if (btnAgregarPersonal) {
      btnAgregarPersonal.addEventListener("click", () => {
        estado.personal.push({
          nombre: "",
          cargo: "",
          dni: "",
          registro: "",
          meses: 0,
          contrato: "",
        });
        guardarEstado();
        render();
      });
    }

    // --- Boton: Eliminar personal ---
    app.querySelectorAll("[data-del-pers]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.delPers, 10);
        estado.personal.splice(idx, 1);
        guardarEstado();
        render();
      });
    });

    // --- Boton: Agregar especifica presupuestaria ---
    const btnAgregarPA = app.querySelector("#btnAgregarPA");
    if (btnAgregarPA) {
      btnAgregarPA.addEventListener("click", () => {
        estado.presupuestoAnalitico.push({
          especifica: "",
          descripcion: "",
          presupuestoModificado: 0,
          ejecutadoMes: 0,
          ejecutadoAcumulado: 0,
        });
        guardarEstado();
        render();
      });
    }

    // --- Boton: Eliminar especifica ---
    app.querySelectorAll("[data-del-pa]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.delPa, 10);
        estado.presupuestoAnalitico.splice(idx, 1);
        guardarEstado();
        render();
      });
    });

    // --- Boton: Nueva valorizacion ---
    const btnNuevaVal = app.querySelector("#btnNuevaVal");
    if (btnNuevaVal) {
      btnNuevaVal.addEventListener("click", () => {
        if (estado.presupuesto.partidas.length === 0) {
          alert("Primero registre las partidas del presupuesto.");
          return;
        }
        const newItems = estado.presupuesto.partidas
          .filter((p) => p.tipo === "directo")
          .map((p) => ({ idPartida: p.id, metradoMes: 0 }));

        estado.valorizaciones.push({
          numero: estado.valorizaciones.length + 1,
          periodo: "",
          fechaInicio: "",
          fechaFin: "",
          pim: 0,
          devengado: 0,
          programadoAcumPct: 0,
          items: newItems,
        });
        estado.valActiva = estado.valorizaciones.length - 1;
        estado.panelActivo = "valorizacion";
        guardarEstado();
        render();
      });
    }

    // --- Boton: Eliminar valorizacion ---
    app.querySelectorAll("[data-del-val]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.delVal, 10);
        if (!confirm(`Eliminar Valorizacion N° ${idx + 1}?`)) return;
        estado.valorizaciones.splice(idx, 1);
        estado.valActiva = Math.max(0, estado.valActiva - 1);
        guardarEstado();
        render();
      });
    });

    // --- Boton: Guardar JSON ---
    const btnGuardarJson = app.querySelector("#btnGuardarJson");
    if (btnGuardarJson) {
      btnGuardarJson.addEventListener("click", () => {
        const json = JSON.stringify(estado, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeName = ((estado.proyecto || {}).cui || "obra").replace(/[^a-zA-Z0-9_-]/g, "_");
        a.href = url;
        a.download = `${safeName}_valorizacion.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    }

    // --- Input: Cargar JSON ---
    const inputCargarJson = app.querySelector("#inputCargarJson");
    if (inputCargarJson) {
      inputCargarJson.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target.result);
            estado = Object.assign(defaultEstado(), parsed);
            guardarEstado();
            render();
          } catch (_) {
            alert("Archivo JSON invalido. Verifique el formato.");
          }
        };
        reader.readAsText(file);
      });
    }

    // --- Boton: Exportar Excel ---
    [app.querySelector("#btnExportarExcel"), app.querySelector("#btnExportarExcel2")].forEach(
      (btn) => {
        if (btn) {
          btn.addEventListener("click", () => {
            exportarExcel(estado);
          });
        }
      },
    );
  }

  // -------------------------------------------------------------------------
  // Inicializacion
  // -------------------------------------------------------------------------

  render();

  globalThis.valorizacionApp = { estado, render };
})();
