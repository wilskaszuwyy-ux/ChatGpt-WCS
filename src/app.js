const { reportData } = globalThis;
const {
  calculateComponentTotals,
  calculatePhysicalGap,
  calculateExecutionRatio,
  formatCurrency,
  formatPercent,
  getRiskLevel,
  matchesQuery,
} = globalThis.dashboardLogic;

const state = {
  query: "",
  componentFilter: "all",
  activePanel: "resumen",
};

const app = document.querySelector("#app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("observado") || normalized.includes("retraso")) return "warning";
  if (normalized.includes("sin modificaciones")) return "neutral";
  return "success";
}

function kpiCard(label, value, detail, variant = "") {
  return `
    <article class="kpi ${variant}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function progressRing(label, percent, caption, variant = "primary") {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  return `
    <article class="ring-card">
      <svg class="ring ${variant}" viewBox="0 0 130 130" role="img" aria-label="${escapeHtml(label)} ${formatPercent(percent)}">
        <circle class="ring-bg" cx="65" cy="65" r="${radius}"></circle>
        <circle class="ring-value" cx="65" cy="65" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        <text x="65" y="61" text-anchor="middle">${formatPercent(percent)}</text>
        <text x="65" y="79" text-anchor="middle">${escapeHtml(label)}</text>
      </svg>
      <p>${escapeHtml(caption)}</p>
    </article>
  `;
}

function table(headers, rows, rowRenderer, emptyMessage = "No hay resultados para el filtro aplicado.") {
  const filteredRows = rows.filter((row) => matchesQuery(row, state.query));
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            filteredRows.length
              ? filteredRows.map(rowRenderer).join("")
              : `<tr><td colspan="${headers.length}" class="empty">${escapeHtml(emptyMessage)}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderComponentRows() {
  const components = reportData.components.filter((component) => {
    if (state.componentFilter === "executed") return component.current > 0;
    if (state.componentFilter === "pending") return component.balance > 0;
    return true;
  });

  return table(
    ["Item", "Componente", "Presupuesto", "Valorizado abril", "Avance", "Saldo"],
    components,
    (component) => `
      <tr>
        <td>${escapeHtml(component.item)}</td>
        <td>
          <strong>${escapeHtml(component.name)}</strong>
          <div class="bar"><span style="width:${component.progress}%"></span></div>
        </td>
        <td>${formatCurrency(component.budget)}</td>
        <td>${formatCurrency(component.current)}</td>
        <td>${formatPercent(component.progress)}</td>
        <td>${formatCurrency(component.balance)}</td>
      </tr>
    `,
  );
}

function renderScheduleChart() {
  const months = reportData.schedule.months;
  const width = 720;
  const height = 280;
  const pad = 42;
  const xStep = (width - pad * 2) / (months.length - 1);
  const y = (percent) => height - pad - (Math.min(percent, 100) / 100) * (height - pad * 2);
  const point = (index, percent) => `${pad + index * xStep},${y(percent)}`;
  const programmed = months.map((month, index) => point(index, month.programmedAccumulatedPercent)).join(" ");
  const physical = months.map((month, index) => point(index, month.executedPhysicalAccumulatedPercent)).join(" ");
  const financial = months.map((month, index) => point(index, month.executedFinancialAccumulatedPercent)).join(" ");

  return `
    <div class="chart-card">
      <div class="chart-title">
        <div>
          <h3>Curva S: programado vs ejecutado</h3>
          <p>Avance acumulado por periodo del costo directo y financiero PIM 2026.</p>
        </div>
        <div class="legend">
          <span><i class="dot programmed"></i>Programado CD</span>
          <span><i class="dot physical"></i>Fisico CD</span>
          <span><i class="dot financial"></i>Financiero PIM</span>
        </div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="line-chart" role="img" aria-label="Curva S de avance fisico y financiero">
        ${[0, 25, 50, 75, 100].map((tick) => `
          <line x1="${pad}" y1="${y(tick)}" x2="${width - pad}" y2="${y(tick)}" class="grid"></line>
          <text x="10" y="${y(tick) + 4}">${tick}%</text>
        `).join("")}
        <polyline points="${programmed}" class="line programmed"></polyline>
        <polyline points="${physical}" class="line physical"></polyline>
        <polyline points="${financial}" class="line financial"></polyline>
        ${months.map((month, index) => `
          <g>
            <line x1="${pad + index * xStep}" y1="${pad}" x2="${pad + index * xStep}" y2="${height - pad}" class="grid vertical"></line>
            <text x="${pad + index * xStep}" y="${height - 12}" text-anchor="middle">${escapeHtml(month.month.split(" ")[0])}</text>
          </g>
        `).join("")}
      </svg>
    </div>
  `;
}

function renderResumen() {
  const totals = calculateComponentTotals(reportData.components);
  const gap = calculatePhysicalGap(reportData.progress.programmed.currentPercent, reportData.progress.executed.currentPercent);
  const risk = getRiskLevel(gap.percent);

  return `
    <section class="panel active" data-panel="resumen">
      <div class="grid two">
        <article class="card">
          <h2>Lectura experta de valorizacion</h2>
          <p>
            La Valorizacion N. 01 fue formulada por metrados realmente ejecutados y aprobados por supervision.
            A nivel de costo directo, abril registra ${formatCurrency(reportData.financial.currentPhysicalAmount)}
            (${formatPercent(reportData.progress.executed.currentPercent)}), por debajo del programado
            ${formatPercent(reportData.progress.programmed.currentPercent)}. La condicion del informe es
            <strong>${escapeHtml(reportData.progress.condition)}</strong>.
          </p>
          <div class="alert ${risk}">
            Brecha fisica: ${formatPercent(gap.percent)}. En administracion directa, esta diferencia debe gestionarse con control de abastecimiento,
            productividad y metrados diarios antes de la siguiente valorizacion.
          </div>
        </article>
        <article class="card">
          <h2>Ficha de obra</h2>
          <dl class="facts">
            <div><dt>CUI</dt><dd>${escapeHtml(reportData.project.cui)}</dd></div>
            <div><dt>Modalidad</dt><dd>${escapeHtml(reportData.meta.modality)}</dd></div>
            <div><dt>Periodo</dt><dd>${escapeHtml(reportData.meta.period)}</dd></div>
            <div><dt>Plazo</dt><dd>${reportData.schedule.approvedTermDays} dias calendario</dd></div>
            <div><dt>Inicio / termino</dt><dd>${escapeHtml(reportData.schedule.startDate)} - ${escapeHtml(reportData.schedule.plannedEndDate)}</dd></div>
            <div><dt>Ubicacion</dt><dd>${escapeHtml(reportData.project.location.locality)}, ${escapeHtml(reportData.project.location.district)}</dd></div>
          </dl>
        </article>
      </div>
      <div class="rings">
        ${progressRing("Programado", reportData.progress.programmed.currentPercent, formatCurrency(reportData.progress.programmed.currentAmount), "programmed")}
        ${progressRing("Fisico", reportData.progress.executed.currentPercent, formatCurrency(reportData.progress.executed.currentAmount), "physical")}
        ${progressRing("Financiero", reportData.progress.financial.currentPercent, formatCurrency(reportData.progress.financial.currentAmount), "financial")}
      </div>
      ${renderScheduleChart()}
      <article class="card">
        <h2>Totales controlados</h2>
        <div class="totals">
          ${kpiCard("Costo directo", formatCurrency(totals.budget), "Base de avance fisico")}
          ${kpiCard("Valorizado abril", formatCurrency(totals.current), "5.96% de costo directo")}
          ${kpiCard("Saldo costo directo", formatCurrency(totals.balance), "94.04% por ejecutar")}
          ${kpiCard("PIM 2026 devengado", formatCurrency(reportData.financial.amountDevenged), "9.87% financiero")}
        </div>
      </article>
    </section>
  `;
}

function renderValorizacion() {
  return `
    <section class="panel" data-panel="valorizacion">
      <div class="section-head">
        <div>
          <h2>Valorizacion mensual de obra</h2>
          <p>Componentes del costo directo con avance de abril, acumulado y saldo.</p>
        </div>
        <div class="segmented" role="group" aria-label="Filtro de componentes">
          ${[
            ["all", "Todos"],
            ["executed", "Con avance"],
            ["pending", "Con saldo"],
          ].map(([id, label]) => `
            <button class="${state.componentFilter === id ? "active" : ""}" data-filter="${id}">${label}</button>
          `).join("")}
        </div>
      </div>
      ${renderComponentRows()}
      <div class="grid two">
        <article class="card">
          <h3>Resumen de valorizacion de obra</h3>
          ${table(
            ["Concepto", "Presupuesto", "Actual", "Acumulado", "Saldo"],
            [
              { concept: "Costo directo", budget: reportData.financial.directCost, current: 25158.52, accumulated: 25158.52, balance: 396704.72 },
              { concept: "Gastos generales CD", budget: reportData.financial.generalExpenses, current: 6515.94, accumulated: 6515.94, balance: 102744.73 },
              { concept: "Gastos de supervision CD", budget: reportData.financial.supervisionExpenses, current: 2064.88, accumulated: 2064.88, balance: 32559.45 },
              { concept: "Total presupuesto de obra", budget: reportData.financial.baseWorkBudget, current: 33739.34, accumulated: 33739.34, balance: 532008.9 },
            ],
            (row) => `
              <tr>
                <td>${escapeHtml(row.concept)}</td>
                <td>${formatCurrency(row.budget)}</td>
                <td>${formatCurrency(row.current)}</td>
                <td>${formatCurrency(row.accumulated)}</td>
                <td>${formatCurrency(row.balance)}</td>
              </tr>
            `,
          )}
        </article>
        <article class="card">
          <h3>Programacion siguiente mes</h3>
          <p>El saldo directo por ejecutar es ${formatCurrency(reportData.financial.directCostBalance)}. El informe programa principalmente estructuras pendientes, arquitectura, instalaciones, manejo ambiental y capacitacion.</p>
          <ul class="check-list">
            ${reportData.components.filter((component) => component.nextMonthProgrammed > 0).map((component) => `
              <li><span>${escapeHtml(component.item)}</span>${escapeHtml(component.name)}: <strong>${formatCurrency(component.nextMonthProgrammed)}</strong></li>
            `).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderMetrados() {
  return `
    <section class="panel" data-panel="metrados">
      <div class="section-head">
        <div>
          <h2>Metrados y partidas ejecutadas</h2>
          <p>Partidas que sustentan la Valorizacion N. 01 y resumen de planilla diaria.</p>
        </div>
      </div>
      ${table(
        ["Codigo", "Descripcion", "Und.", "Metrado", "Valorizacion", "Avance"],
        reportData.executedItems,
        (item) => `
          <tr>
            <td>${escapeHtml(item.code)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.unit)}</td>
            <td>${item.metrado}</td>
            <td>${formatCurrency(item.valuation)}</td>
            <td>${formatPercent(item.progress)}</td>
          </tr>
        `,
      )}
      <div class="grid two">
        <article class="card">
          <h3>Planilla de metrados detallada</h3>
          ${table(
            ["Codigo", "Partida", "Detalle", "Cantidad", "Und."],
            reportData.detailedMetrados,
            (row) => `
              <tr>
                <td>${escapeHtml(row.code)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td>${escapeHtml(row.detail)}</td>
                <td>${row.quantity}</td>
                <td>${escapeHtml(row.unit)}</td>
              </tr>
            `,
          )}
        </article>
        <article class="card">
          <h3>Lectura de planillas diarias</h3>
          <ul class="timeline-list">
            ${reportData.dailyHighlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderControl() {
  return `
    <section class="panel" data-panel="control">
      <div class="grid two">
        <article class="card">
          <h2>Control segun Directiva 017-2023-CG</h2>
          <p>Tablero de evidencias para administracion directa: control de metrados, valorizacion, comparativo fisico-financiero, personal, modificaciones y sustento documental.</p>
          <div class="control-grid">
            ${reportData.normativeControls.map((control) => `
              <article class="control ${statusClass(control.status)}">
                <strong>${escapeHtml(control.name)}</strong>
                <span>${escapeHtml(control.status)}</span>
                <p>${escapeHtml(control.evidence)}</p>
              </article>
            `).join("")}
          </div>
        </article>
        <article class="card">
          <h2>Hallazgos y riesgos de gestion</h2>
          <ul class="risk-list">
            ${reportData.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
          </ul>
        </article>
      </div>
      <div class="grid two">
        <article class="card">
          <h3>Preguntas de control tecnico</h3>
          ${table(
            ["Tema", "Pronunciamiento de supervision"],
            reportData.controlQuestions,
            (row) => `
              <tr>
                <td>${escapeHtml(row.topic)}</td>
                <td>${escapeHtml(row.answer)}</td>
              </tr>
            `,
          )}
        </article>
        <article class="card">
          <h3>Comunicaciones importantes</h3>
          <ul class="timeline-list">
            ${reportData.communications.map((communication) => `<li>${escapeHtml(communication)}</li>`).join("")}
          </ul>
        </article>
      </div>
      <div class="grid two">
        <article class="card">
          <h3>Conclusiones</h3>
          <ol class="number-list">
            ${reportData.conclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </article>
        <article class="card">
          <h3>Recomendaciones</h3>
          <ol class="number-list">
            ${reportData.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </article>
      </div>
    </section>
  `;
}

function renderPresupuesto() {
  return `
    <section class="panel" data-panel="presupuesto">
      <div class="grid two">
        <article class="card">
          <h2>Presupuesto aprobado y modificado</h2>
          ${table(
            ["Concepto", "Aprobado", "Modificado", "% total"],
            reportData.budgetBreakdown,
            (row) => `
              <tr>
                <td>${escapeHtml(row.concept)}</td>
                <td>${formatCurrency(row.approved)}</td>
                <td>${formatCurrency(row.modified)}</td>
                <td>${formatPercent(row.percent)}</td>
              </tr>
            `,
          )}
        </article>
        <article class="card">
          <h2>Ejecucion de gasto</h2>
          <div class="totals stacked">
            ${kpiCard("PIM 2026", formatCurrency(reportData.financial.pim2026), "Presupuesto institucional modificado")}
            ${kpiCard("Devengado al 30/04", formatCurrency(reportData.financial.amountDevenged), `${formatPercent(reportData.progress.financial.currentPercent)} del PIM 2026`, "accent")}
            ${kpiCard("Saldo presupuestario", formatCurrency(reportData.financial.budgetBalance), "Saldo reportado en ficha tecnica")}
            ${kpiCard("Saldo por asignar", formatCurrency(reportData.financial.balanceToAssign), "Control presupuestal")}
          </div>
        </article>
      </div>
      <article class="card">
        <h2>Presupuesto analitico modificado y ejecutado a abril</h2>
        ${table(
          ["Especifica", "Descripcion", "PIM 2026", "Ejecutado", "Saldo", "% ejec."],
          reportData.analyticalBudget,
          (row) => `
            <tr>
              <td>${escapeHtml(row.code)}</td>
              <td>${escapeHtml(row.description)}</td>
              <td>${formatCurrency(row.pim2026)}</td>
              <td>${formatCurrency(row.executedToApril)}</td>
              <td>${formatCurrency(row.balance2026)}</td>
              <td>${formatPercent(calculateExecutionRatio(row.executedToApril, row.pim2026))}</td>
            </tr>
          `,
        )}
      </article>
    </section>
  `;
}

function renderPersonal() {
  return `
    <section class="panel" data-panel="personal">
      <div class="grid two">
        <article class="card">
          <h2>Responsables principales</h2>
          <dl class="facts">
            <div><dt>Supervisor</dt><dd>Ing. Wilber Carbajal Sulca - CIP 281754</dd></div>
            <div><dt>Residente</dt><dd>Ing. Felix Yaranga Guillen - CIP 124398</dd></div>
            <div><dt>Presentacion</dt><dd>Informe N. 018-2026-MDUA/UFSLO/WCS-SO</dd></div>
            <div><dt>Lugar y fecha</dt><dd>Union Ashaninka, 11 de mayo de 2026</dd></div>
          </dl>
        </article>
        <article class="card">
          <h2>Alcance del proyecto</h2>
          <p>${escapeHtml(reportData.project.description)}</p>
          <ul class="check-list">
            ${reportData.project.physicalTargets.map((target) => `<li>${escapeHtml(target)}</li>`).join("")}
          </ul>
        </article>
      </div>
      ${table(
        ["Nombre", "Cargo / rol", "DNI", "Registro", "Participacion", "Tiempo", "Documento"],
        reportData.staff,
        (person) => `
          <tr>
            <td>${escapeHtml(person.name)}</td>
            <td>${escapeHtml(person.role)}</td>
            <td>${escapeHtml(person.dni)}</td>
            <td>${escapeHtml(person.registry)}</td>
            <td>${person.participation}</td>
            <td>${person.months} meses</td>
            <td>${escapeHtml(person.contract)}</td>
          </tr>
        `,
      )}
    </section>
  `;
}

function renderDocumento() {
  return `
    <section class="panel" data-panel="documento">
      <div class="grid two">
        <article class="card">
          <h2>Documento completo offline</h2>
          <p>El PDF fuente se encuentra embebido en este dashboard para conservar toda la informacion del archivo adjunto, incluyendo anexos, formatos, tablas y panel fotografico.</p>
          <div class="actions">
            <button id="loadPdf" class="primary">Cargar visor PDF</button>
            <a id="downloadPdf" class="button ghost" download="${escapeHtml(reportData.meta.sourceFile)}">Descargar PDF embebido</a>
          </div>
          <p class="muted">Si el navegador bloquea la vista embebida al abrir desde archivo local, use el boton de descarga o ejecute un servidor local simple.</p>
        </article>
        <article class="card">
          <h2>Secciones incluidas</h2>
          <ul class="columns">
            ${reportData.sourceSections.map((section) => `<li>${escapeHtml(section)}</li>`).join("")}
          </ul>
        </article>
      </div>
      <div class="pdf-shell">
        <iframe id="pdfFrame" title="Informe mensual de supervision abril 2026"></iframe>
      </div>
    </section>
  `;
}

function renderNavigation() {
  const panels = [
    ["resumen", "Resumen ejecutivo"],
    ["valorizacion", "Valorizacion"],
    ["metrados", "Metrados"],
    ["control", "Control normativo"],
    ["presupuesto", "Presupuesto"],
    ["personal", "Personal"],
    ["documento", "Documento fuente"],
  ];
  return panels.map(([id, label]) => `
    <button class="${state.activePanel === id ? "active" : ""}" data-panel-target="${id}">${label}</button>
  `).join("");
}

function render() {
  const gap = calculatePhysicalGap(reportData.progress.programmed.currentPercent, reportData.progress.executed.currentPercent);
  app.innerHTML = `
    <header class="hero">
      <div class="hero-content">
        <span class="eyebrow">${escapeHtml(reportData.meta.standardFocus)} | ${escapeHtml(reportData.meta.modality)}</span>
        <h1>Dashboard de valorizacion de obra por administracion directa</h1>
        <p>${escapeHtml(reportData.project.name)}</p>
        <div class="hero-meta">
          <span>${escapeHtml(reportData.entity.name)}</span>
          <span>${escapeHtml(reportData.meta.period)}</span>
          <span>CUI ${escapeHtml(reportData.project.cui)}</span>
        </div>
      </div>
      <div class="hero-status ${getRiskLevel(gap.percent)}">
        <span>Estado de obra</span>
        <strong>${escapeHtml(reportData.progress.condition)}</strong>
        <small>Brecha ${formatPercent(gap.percent)}</small>
      </div>
    </header>
    <section class="toolbar">
      <label class="search">
        <span>Buscar en dashboard</span>
        <input id="globalSearch" type="search" placeholder="Ej.: metrado, modulo prefabricado, supervisor..." value="${escapeHtml(state.query)}">
      </label>
      <nav class="tabs" aria-label="Secciones del dashboard">
        ${renderNavigation()}
      </nav>
    </section>
    <main>
      ${renderResumen()}
      ${renderValorizacion()}
      ${renderMetrados()}
      ${renderControl()}
      ${renderPresupuesto()}
      ${renderPersonal()}
      ${renderDocumento()}
    </main>
  `;

  app.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === state.activePanel);
  });

  wireEvents();
}

function wireEvents() {
  app.querySelector("#globalSearch").addEventListener("input", (event) => {
    state.query = event.target.value;
    const cursorPosition = event.target.selectionStart ?? state.query.length;
    render();
    const search = app.querySelector("#globalSearch");
    search.focus();
    search.setSelectionRange(cursorPosition, cursorPosition);
  });

  app.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePanel = button.dataset.panelTarget;
      render();
    });
  });

  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.componentFilter = button.dataset.filter;
      render();
    });
  });

  const loadPdf = app.querySelector("#loadPdf");
  if (loadPdf) {
    loadPdf.addEventListener("click", async () => {
      loadPdf.disabled = true;
      loadPdf.textContent = "Cargando PDF...";
      const informePdfBase64 = await loadPdfData();
      const dataUrl = `data:application/pdf;base64,${informePdfBase64}`;
      app.querySelector("#pdfFrame").src = dataUrl;
      app.querySelector("#downloadPdf").href = dataUrl;
      loadPdf.textContent = "PDF cargado";
    });
  }
}

function loadPdfData() {
  if (globalThis.informePdfBase64) {
    return Promise.resolve(globalThis.informePdfBase64);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "src/pdfData.js";
    script.onload = () => resolve(globalThis.informePdfBase64);
    script.onerror = () => reject(new Error("No se pudo cargar el PDF embebido."));
    document.body.appendChild(script);
  });
}

render();
