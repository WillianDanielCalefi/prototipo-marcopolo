import { buildAppData } from "./data.js";
import { fmtNum, fmtBRL, fmtSignedBRL, fmtSignedNum } from "./formatters.js";
import { initializeMillerOrr } from "./miller-orr.js";
import { initializeStocksTab } from "./stocks.js";

let DATA = [];

initializeStocksTab();
initializeMillerOrr();

if (window.lucide) {
  window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
} else {
  console.error("Não foi possível carregar a biblioteca Lucide.");
}

const themeToggle = document.getElementById("themeToggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  const actionLabel = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  themeToggle.setAttribute("aria-label", actionLabel);
  themeToggle.title = actionLabel;
  themeColor.content = "#071426";

  if (persist) {
    try {
      localStorage.setItem("marcopolo-theme", theme);
    } catch (error) {
      console.error("Não foi possível salvar a preferência de tema:", error);
    }
  }
}

let savedTheme = "light";
try {
  const storedTheme = localStorage.getItem("marcopolo-theme");
  if (storedTheme === "light" || storedTheme === "dark") savedTheme = storedTheme;
} catch (error) {
  console.error("Não foi possível recuperar a preferência de tema:", error);
}
applyTheme(savedTheme);
themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

const trendMetricSelect = document.getElementById("trendMetric");
const trendChart = document.getElementById("cycleChart");
const trendChartTitle = document.getElementById("trendChartTitle");
const trendChartDescription = document.getElementById("trendChartDescription");
const trendMetrics = {
  cicloFin: {
    title: "Evolução do Ciclo Financeiro (dias)",
    description: "Série anual do ciclo financeiro, calculado com base de 360 dias.",
    field: "cicloFin",
    format: value => `${fmtNum(value)} dias`,
    axis: value => fmtNum(value)
  },
  ncg: {
    title: "Evolução da Necessidade de Capital de Giro (NCG)",
    description: "Valores em R$ milhões; a NCG indica os recursos necessários para financiar a operação.",
    field: "ncg",
    format: fmtBRL,
    axis: value => fmtBRL(value, 0)
  },
  st: {
    title: "Evolução do Saldo de Tesouraria (ST)",
    description: "Valores em R$ milhões; acompanhe a folga financeira de curto prazo ao longo dos anos.",
    field: "st",
    format: fmtBRL,
    axis: value => fmtBRL(value, 0)
  }
};
let trendChartType = "bar";

function renderTrendChart() {
  if (!DATA.length) return;
  const metric = trendMetrics[trendMetricSelect.value];
  const values = DATA.map(row => row[metric.field]);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  trendChartTitle.textContent = metric.title;
  trendChartDescription.textContent = metric.description;

  if (trendChartType === "bar") {
    trendChart.className = "bar-list";
    trendChart.innerHTML = DATA.map((row, index) => {
      const percent = Math.max(2, row[metric.field] / maximum * 100);
      const currentClass = index === DATA.length - 1 ? "trend-current" : "";
      return `
        <div class="bar-row" aria-label="${row.year}: ${metric.format(row[metric.field])}">
          <strong>${row.year}</strong>
          <div class="bar-track">
            <div class="bar-fill ${currentClass}" style="width:${percent}%"></div>
          </div>
          <span>${metric.format(row[metric.field])}</span>
        </div>
      `;
    }).join("");
    return;
  }

  const chartWidth = 720;
  const chartHeight = 280;
  const left = 96;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const range = maximum - minimum || 1;
  const points = DATA.map((row, index) => ({
    x: left + (index / Math.max(DATA.length - 1, 1)) * plotWidth,
    y: top + ((maximum - row[metric.field]) / range) * plotHeight,
    row
  }));
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = top + ratio * plotHeight;
    const value = maximum - ratio * range;
    return `<g class="line-grid"><line x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}"></line><text x="${left - 10}" y="${y + 4}" text-anchor="end">${metric.axis(value)}</text></g>`;
  }).join("");
  const line = points.map(point => `${point.x},${point.y}`).join(" ");
  const dots = points.map((point, index) => `
    <g class="${index === points.length - 1 ? "line-point current" : "line-point"}">
      <circle cx="${point.x}" cy="${point.y}" r="4.5"><title>${point.row.year}: ${metric.format(point.row[metric.field])}</title></circle>
      <text class="line-year" x="${point.x}" y="${chartHeight - 10}" text-anchor="middle">${point.row.year}</text>
    </g>
  `).join("");
  trendChart.className = "trend-line-chart";
  trendChart.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${metric.title}, de 2017 a 2025">
      ${grid}
      <polyline class="trend-line" points="${line}"></polyline>
      ${dots}
    </svg>
  `;
}

trendMetricSelect.addEventListener("change", renderTrendChart);
document.querySelectorAll(".chart-type-btn").forEach(button => {
  button.addEventListener("click", () => {
    trendChartType = button.dataset.chartType;
    document.querySelectorAll(".chart-type-btn").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderTrendChart();
  });
});

function populateYearOptions() {
  const selects = [yearSelect, challengeYearSelect, stratYearSelect, cashFlowYearSelect];
  for (const select of selects) {
    select.replaceChildren();
    for (const item of DATA) {
      const option = document.createElement("option");
      option.value = item.year;
      option.textContent = select === yearSelect
        ? `${item.year} (${item.phase}) — Ciclo: ${fmtNum(item.cicloFin)}d | NCG: ${fmtBRL(item.ncg)} | ST: ${fmtBRL(item.st)}`
        : select === stratYearSelect
          ? `${item.year} (${item.phase}) — Ciclo: ${fmtNum(item.cicloFin)}d | NCG: ${fmtBRL(item.ncg)} | ST: ${fmtBRL(item.st)} | Folga: ${fmtSignedBRL(item.folgaCaixa)}`
        : select === cashFlowYearSelect
          ? `${item.year}`
          : `${item.year} (${item.phase})`;
      if (item.year === Number(select.dataset.defaultYear || (select === challengeYearSelect ? 2022 : 2025))) option.selected = true;
      select.appendChild(option);
    }
  }
}

// Tabs
const mobileNavToggle = document.getElementById("mobileNavToggle");
const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
const mobileNavClose = document.getElementById("mobileNavClose");
const mobileNavCurrent = document.getElementById("mobileNavCurrent");
const appTabs = document.getElementById("appTabs");

function setMobileNavOpen(isOpen, restoreFocus = false) {
  if (!mobileNavToggle || !mobileNavBackdrop || !appTabs) return;
  if (!isOpen && mobileNavToggle.getAttribute("aria-expanded") !== "true") return;

  mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
  appTabs.classList.toggle("is-open", isOpen);
  mobileNavBackdrop.hidden = !isOpen;
  document.body.classList.toggle("mobile-nav-open", isOpen);

  if (isOpen) {
    const activeTab = appTabs.querySelector(".tab-btn.active") || appTabs.querySelector(".tab-btn");
    if (activeTab) activeTab.focus();
  } else if (restoreFocus) {
    mobileNavToggle.focus();
  }
}

if (mobileNavToggle && mobileNavBackdrop && appTabs) {
  mobileNavToggle.addEventListener("click", () => {
    setMobileNavOpen(mobileNavToggle.getAttribute("aria-expanded") !== "true");
  });
  mobileNavBackdrop.addEventListener("click", () => setMobileNavOpen(false, true));
  if (mobileNavClose) {
    mobileNavClose.addEventListener("click", () => setMobileNavOpen(false, true));
  }

  document.addEventListener("keydown", event => {
    if (mobileNavToggle.getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMobileNavOpen(false, true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusableItems = appTabs.querySelectorAll("button:not(:disabled)");
    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    if (!firstItem || !lastItem) return;
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) setMobileNavOpen(false);
  });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove("active");
      b.removeAttribute("aria-current");
    });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-current", "page");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (mobileNavCurrent) mobileNavCurrent.textContent = btn.textContent.trim();
    setMobileNavOpen(false, true);
  });
});

// Diagnóstico
function renderDiagnostico() {
  const preRows = DATA.filter(d => d.phase === "Pré");
  const posRows = DATA.filter(d => d.phase === "Pós");
  const r2017 = DATA.find(d => d.year === 2017);
  const r2025 = DATA.find(d => d.year === 2025);

  const avgPreCycle = preRows.reduce((s, x) => s + x.cicloFin, 0) / preRows.length;
  const avgPosCycle = posRows.reduce((s, x) => s + x.cicloFin, 0) / posRows.length;

  document.getElementById("kpiCycleAvg").textContent = `${fmtNum(avgPreCycle)}d → ${fmtNum(avgPosCycle)}d`;
  document.getElementById("kpiNcgRev").textContent = `${fmtNum(r2017.ncgPctRec * 100)}% → ${fmtNum(r2025.ncgPctRec * 100)}%`;
  document.getElementById("kpiNcgRevSub").textContent = `NCG de ${fmtBRL(r2017.ncg)} (2017) a ${fmtBRL(r2025.ncg)} (2025)`;
  document.getElementById("kpiSt2025").textContent = fmtBRL(r2025.st);
  document.getElementById("kpiStSub").textContent = `Em 2025 (vs. ${fmtBRL(r2017.st)} em 2017; CGL de ${fmtBRL(r2025.cgl)})`;

  const tbody = document.getElementById("historyBody");
  renderTrendChart();

  tbody.innerHTML = DATA.map(d => {
    const badgeClass = d.phase === "Pré" ? "p-pre" : d.phase === "Pandemia" ? "p-pan" : "p-pos";
    const folgaCls = d.folgaCaixa < 0 ? "neg" : "pos";
    return `
      <tr>
        <td><strong>${d.year}</strong></td>
        <td><span class="phase-pill ${badgeClass}">${d.phase}</span></td>
        <td>${fmtNum(d.pmrv)}</td>
        <td>${fmtNum(d.pmre)}</td>
        <td>${fmtNum(d.pmpc)}</td>
        <td><strong>${fmtNum(d.cicloFin)}</strong></td>
        <td>${fmtBRL(d.ncg)}</td>
        <td>${fmtBRL(d.st)}</td>
        <td>${fmtBRL(d.cgl)}</td>
        <td>${fmtBRL(d.caixaMin)}</td>
        <td class="${folgaCls}"><strong>${fmtSignedBRL(d.folgaCaixa)}</strong></td>
        <td>${fmtNum(d.convCxLucro, 2)}x</td>
        <td>${fmtNum(d.vencidoPct * 100)}%</td>
      </tr>
    `;
  }).join("");

  document.getElementById("turnoverBody").innerHTML = DATA.map(d => `
    <tr>
      <td><strong>${d.year}</strong></td>
      <td>${fmtNum(d.giroRecebiveis, 2)}x</td>
      <td>${fmtNum(d.giroEstoques, 2)}x</td>
      <td>${fmtNum(d.giroFornecedores, 2)}x</td>
      <td>${fmtNum(d.cicloEcon)} dias</td>
    </tr>
  `).join("");

  const comparisonBody = document.getElementById("comparisonBody");
  if (comparisonBody) {
    const periods = [
      { label: "2017–2019 (pré-pandemia)", years: [2017, 2018, 2019] },
      { label: "2020–2021 (durante)", years: [2020, 2021] },
      { label: "2022–2025 (pós-pandemia)", years: [2022, 2023, 2024, 2025] }
    ];
    const avg = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
    const periodRows = periods.map(period => {
      const rows = DATA.filter(row => period.years.includes(row.year));
      return {
        label: period.label,
        pmrv: avg(rows, "pmrv"),
        pmre: avg(rows, "pmre"),
        pmpc: avg(rows, "pmpc"),
        cicloFin: avg(rows, "cicloFin"),
        cicloEcon: avg(rows, "cicloEcon"),
        ncg: avg(rows, "ncg"),
        st: avg(rows, "st"),
        caixaMin: avg(rows, "caixaMin"),
        folgaCaixa: avg(rows, "folgaCaixa"),
        cgp: avg(rows, "cgp"),
        cgpPctCgl: avg(rows, "cgpPctCgl"),
        cglPctRec: avg(rows, "cglPctRec")
      };
    });

    comparisonBody.innerHTML = periodRows.map(d => {
      const folgaCls = d.folgaCaixa < 0 ? "neg" : "pos";
      return `
        <tr>
          <td><strong>${d.label}</strong></td>
          <td>${fmtNum(d.pmrv)}</td>
          <td>${fmtNum(d.pmre)}</td>
          <td>${fmtNum(d.pmpc)}</td>
          <td><strong>${fmtNum(d.cicloFin)}</strong></td>
          <td>${fmtNum(d.cicloEcon)}</td>
          <td>${fmtBRL(d.ncg)}</td>
          <td>${fmtBRL(d.st)}</td>
          <td>${fmtBRL(d.caixaMin)}</td>
          <td class="${folgaCls}"><strong>${fmtSignedBRL(d.folgaCaixa)}</strong></td>
          <td>${fmtSignedBRL(d.cgp)}</td>
          <td>${fmtNum(d.cgpPctCgl * 100)}%</td>
          <td>${fmtNum(d.cglPctRec * 100)}%</td>
        </tr>
      `;
    }).join("");

    document.getElementById("averageBalanceBody").innerHTML = DATA.map(d => `
      <tr>
        <td><strong>${d.year}</strong></td>
        <td>${fmtNum(d.pmrvSaldoMedio)} dias</td>
        <td>${fmtNum(d.pmreSaldoMedio)} dias</td>
        <td>${fmtNum(d.pmpcSaldoMedio)} dias</td>
        <td>${fmtNum(d.cicloFinSaldoMedio)} dias</td>
        <td>${fmtSignedNum(d.diferencaCicloMedio, 1, " dias")}</td>
      </tr>
    `).join("");

    const pre = periodRows[0];
    const during = periodRows[1];
    const post = periodRows[2];
    document.getElementById("periodPreRead").innerHTML =
      `<strong>Pré-pandemia:</strong> PMRV de ${fmtNum(pre.pmrv)} dias, PMRE de ${fmtNum(pre.pmre)} dias, ciclo de ${fmtNum(pre.cicloFin)} dias, NCG de ${fmtBRL(pre.ncg)} e folga de ${fmtSignedBRL(pre.folgaCaixa)}.`;
    document.getElementById("periodDuringRead").innerHTML =
      `<strong>Durante a pandemia:</strong> ciclo de ${fmtNum(during.cicloFin)} dias, PMRE elevado a ${fmtNum(during.pmre)} dias e NCG de ${fmtBRL(during.ncg)}.`;
    document.getElementById("periodPostRead").innerHTML =
      `<strong>Pós-pandemia:</strong> PMRV de ${fmtNum(post.pmrv)} dias, PMRE de ${fmtNum(post.pmre)} dias, ciclo de ${fmtNum(post.cicloFin)} dias, ST de ${fmtBRL(post.st)} e folga de ${fmtSignedBRL(post.folgaCaixa)}.`;
  }
}

function renderCashFlowDashboard() {
  const selectedYear = Number(cashFlowYearSelect.value);
  const selected = DATA.find(item => item.year === selectedYear);
  if (!selected) return;

  document.getElementById("cashFlowCfo").textContent = fmtSignedBRL(selected.cfo);
  document.getElementById("cashFlowCfi").textContent = fmtSignedBRL(selected.cfi);
  document.getElementById("cashFlowCff").textContent = fmtSignedBRL(selected.cff);
  document.getElementById("cashFlowChange").textContent = fmtSignedBRL(selected.variacaoCaixa);
  const selectedMetrics = [
    ["CFO — atividades operacionais", selected.cfo],
    ["CFI — atividades de investimento", selected.cfi],
    ["CFF — atividades de financiamento", selected.cff],
    ["Efeito cambial", selected.efeitoCambial],
    ["Variação líquida de caixa", selected.variacaoCaixa],
    ["Caixa livre", selected.caixaLivre]
  ];
  const maxValue = Math.max(...selectedMetrics.map(([, value]) => Math.abs(value)), 1);
  document.getElementById("cashFlowSelectedChart").innerHTML = selectedMetrics.map(([label, value]) => {
    const width = Math.min(Math.abs(value) / maxValue * 44, 44);
    const signClass = value < 0 ? "negative" : "positive";
    const truck = value === 0 ? "" : `<svg class="flow-truck" viewBox="0 0 28 20" aria-hidden="true"><path class="truck-body" d="M1 4h15v11H1zM16 8h6l4 4v3H16z"/><path class="truck-window" d="M18 9h3.5l2.8 3H18z"/><circle class="truck-wheel" cx="7" cy="16" r="2.5"/><circle class="truck-wheel" cx="21" cy="16" r="2.5"/></svg>`;
    return `<div class="flow-bar-row flow-selected"><strong>${label}</strong><div class="flow-track"><span class="flow-bar ${signClass}" style="width:${width}%">${truck}</span></div><span>${fmtSignedBRL(value)}</span></div>`;
  }).join("");
  document.getElementById("cashFlowHistoryBody").innerHTML = DATA.map(item => `
    <tr>
      <td><strong>${item.year}</strong></td>
      <td>${fmtSignedBRL(item.cfo)}</td>
      <td>${fmtSignedBRL(item.cfi)}</td>
      <td>${fmtSignedBRL(item.cff)}</td>
      <td>${fmtSignedBRL(item.efeitoCambial)}</td>
      <td><strong>${fmtSignedBRL(item.variacaoCaixa)}</strong></td>
      <td>${fmtSignedBRL(item.caixaLivre)}</td>
      <td>${fmtSignedBRL(item.capex)}</td>
      <td>${fmtSignedBRL(item.captacaoLiquida)}</td>
      <td>${fmtSignedBRL(item.jurosPagos)}</td>
      <td>${fmtSignedBRL(item.dividendosPagos)}</td>
      <td>${fmtSignedBRL(item.arrendamentosPagos)}</td>
      <td>${fmtSignedBRL(item.outrosFluxos)}</td>
      <td>${fmtNum(item.payoutDividendos * 100)}%</td>
    </tr>
  `).join("");
}

// Cálculo exato a partir das linhas reais da planilha (em R$ milhões, 360 dias)
function calcScenarioFromBase(base, newPmre, newPmrv, newPmpc, disbPct) {
  const cpvPos = -base.cpvInd;
  const dClientes = ((newPmrv - base.pmrv) * base.recLiqInd) / 360.0;
  const dEstoques = ((newPmre - base.pmre) * cpvPos) / 360.0;
  const dFornec = ((newPmpc - base.pmpc) * base.compras) / 360.0;

  const ncgDelta = dClientes + dEstoques - dFornec;
  const simNcg = base.ncg + ncgDelta;
  const simSt = base.cgl - simNcg;
  const stDelta = simSt - base.st;

  const simCycle = newPmre + newPmrv - newPmpc;
  const cycleDiff = simCycle - base.cicloFin;

  const simDisb = base.desembolsos * (1 + disbPct / 100);
  const simGiro = simCycle > 0 ? 360.0 / simCycle : base.giroCaixa;
  const simMinCash = Math.max(0, simDisb / simGiro);
  const minCashDelta = simMinCash - base.caixaMin;
  const simFolga = base.caixaReal - simMinCash;

  return {
    simCycle, cycleDiff,
    ncgDelta, simNcg,
    stDelta, simSt,
    simMinCash, minCashDelta,
    simFolga
  };
}

// Aba 2: Simulador
const yearSelect = document.getElementById("baseYear");
const cashFlowYearSelect = document.getElementById("cashFlowYear");
const pmreSlider = document.getElementById("pmreSlider");
const pmrvSlider = document.getElementById("pmrvSlider");
const pmpcSlider = document.getElementById("pmpcSlider");
const disbSlider = document.getElementById("disbSlider");

DATA.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d.year;
  opt.textContent = `${d.year} (${d.phase}) — Ciclo: ${fmtNum(d.cicloFin)}d | NCG: ${fmtBRL(d.ncg)} | ST: ${fmtBRL(d.st)}`;
  if (d.year === 2025) opt.selected = true;
  yearSelect.appendChild(opt);
});

function getBaseRow() {
  return DATA.find(d => d.year === Number(yearSelect.value)) || DATA[DATA.length - 1];
}

function loadYearIntoSliders() {
  const base = getBaseRow();
  pmreSlider.value = base.pmre.toFixed(1);
  pmrvSlider.value = base.pmrv.toFixed(1);
  pmpcSlider.value = base.pmpc.toFixed(1);
  disbSlider.value = 0;
  updateSimulator();
}

function updateSimulator() {
  const base = getBaseRow();
  [pmreSlider, pmrvSlider, pmpcSlider, disbSlider].forEach(slider => {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);
    slider.style.setProperty("--range-progress", `${(value - min) / (max - min) * 100}%`);
  });
  const pmre = parseFloat(pmreSlider.value);
  const pmrv = parseFloat(pmrvSlider.value);
  const pmpc = parseFloat(pmpcSlider.value);
  const disbPct = parseFloat(disbSlider.value);

  document.getElementById("pmreVal").textContent = `${fmtNum(pmre)} dias`;
  document.getElementById("pmrvVal").textContent = `${fmtNum(pmrv)} dias`;
  document.getElementById("pmpcVal").textContent = `${fmtNum(pmpc)} dias`;
  document.getElementById("disbVal").textContent = `${disbPct >= 0 ? "+" : ""}${disbPct}%`;

  document.getElementById("simBaseContext").textContent =
    `Base ${base.year}: Rec. Líq. ${fmtBRL(base.recLiqInd)}, −CPV ${fmtBRL(-base.cpvInd)}, Compras ${fmtBRL(base.compras)}, Desembolsos ${fmtBRL(base.desembolsos)} e CGL ${fmtBRL(base.cgl)}.`;

  const res = calcScenarioFromBase(base, pmre, pmrv, pmpc, disbPct);

  document.getElementById("simCycle").textContent = `${fmtNum(res.simCycle)} dias`;
  const cycleDeltaEl = document.getElementById("simCycleDelta");
  cycleDeltaEl.textContent = `${fmtSignedNum(res.cycleDiff, 1, " dias")} vs. ${base.year}`;
  cycleDeltaEl.className = "delta " + (res.cycleDiff <= 0 ? "pos" : "neg");

  document.getElementById("simNcg").textContent = fmtBRL(res.simNcg);
  const ncgDeltaEl = document.getElementById("simNcgDelta");
  ncgDeltaEl.textContent = `${fmtSignedBRL(res.ncgDelta)} vs. ${base.year}`;
  ncgDeltaEl.className = "delta " + (res.ncgDelta <= 0 ? "pos" : "neg");

  document.getElementById("simSt").textContent = fmtBRL(res.simSt);
  const stDeltaEl = document.getElementById("simStDelta");
  stDeltaEl.textContent = `${fmtSignedBRL(res.stDelta)} vs. ${base.year}`;
  stDeltaEl.className = "delta " + (res.stDelta >= 0 ? "pos" : "neg");

  document.getElementById("simMinCash").textContent = fmtBRL(res.simMinCash);
  const minCashDeltaEl = document.getElementById("simMinCashDelta");
  minCashDeltaEl.textContent = `${fmtSignedBRL(res.minCashDelta)} vs. ${fmtBRL(base.caixaMin)}`;
  minCashDeltaEl.className = "delta " + (res.minCashDelta <= 0 ? "pos" : "warn");

  const interp = document.getElementById("simInterpretation");
  if (res.cycleDiff < -0.5) {
    interp.className = "callout ok-box";
    interp.innerHTML = `<strong>Liberação de giro:</strong> Encurtar o ciclo em <strong>${fmtNum(Math.abs(res.cycleDiff))} dias</strong> altera a NCG em <strong>${fmtSignedBRL(res.ncgDelta)}</strong>, desloca <strong>${fmtSignedBRL(res.stDelta)}</strong> para o Saldo de Tesouraria e ajusta o caixa mínimo em <strong>${fmtSignedBRL(res.minCashDelta)}</strong> (folga estimada de <strong>${fmtSignedBRL(res.simFolga)}</strong> frente ao caixa real de ${fmtBRL(base.caixaReal)}).`;
  } else if (res.cycleDiff > 0.5) {
    interp.className = "callout warn-box";
    interp.innerHTML = `<strong>Pressão sobre o giro:</strong> Alongar o ciclo em <strong>${fmtNum(res.cycleDiff)} dias</strong> eleva a NCG em <strong>${fmtSignedBRL(res.ncgDelta)}</strong>, reduz o Saldo de Tesouraria em <strong>${fmtSignedBRL(res.stDelta)}</strong> e altera o caixa mínimo em <strong>${fmtSignedBRL(res.minCashDelta)}</strong> (folga estimada de <strong>${fmtSignedBRL(res.simFolga)}</strong>).`;
  } else {
    interp.className = "callout";
    interp.innerHTML = `<strong>Cenário próximo ao realizado em ${base.year}:</strong> Ciclo de <strong>${fmtNum(res.simCycle)} dias</strong>, NCG de <strong>${fmtBRL(res.simNcg)}</strong>, ST de <strong>${fmtBRL(res.simSt)}</strong> e caixa mínimo de <strong>${fmtBRL(res.simMinCash)}</strong> (folga de <strong>${fmtSignedBRL(res.simFolga)}</strong>).`;
  }
}

yearSelect.addEventListener("change", loadYearIntoSliders);
[pmreSlider, pmrvSlider, pmpcSlider, disbSlider].forEach(el => el.addEventListener("input", updateSimulator));
document.getElementById("resetSimBtn").addEventListener("click", loadYearIntoSliders);
document.getElementById("presetPreBtn")?.addEventListener("click", () => {
  pmreSlider.value = "66.7";
  updateSimulator();
});

// Aba 3: Desafio CFO parametrizado por ano
const challengeYearSelect = document.getElementById("challengeYear");
const challengeOptions = document.getElementById("challengeOptions");

DATA.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d.year;
  opt.textContent = `${d.year} (${d.phase})`;
  if (d.year === 2022) opt.selected = true;
  challengeYearSelect.appendChild(opt);
});

function renderChallengeOptions() {
  const base = DATA.find(d => d.year === Number(challengeYearSelect.value)) || DATA.find(d => d.year === 2022);
  const issue = [
    base.pmre >= 100 ? "estoques elevados" : null,
    base.pmrv >= 70 ? "recebimentos lentos" : null,
    base.folgaCaixa < 0 ? "folga de caixa negativa" : null,
    base.pmpc < 40 ? "prazo curto com fornecedores" : null
  ].filter(Boolean);

  document.getElementById("challengeTitle").textContent = `Missão CFO: Recuperar Liquidez de ${base.year}`;
  document.getElementById("challengeContext").innerHTML =
    `Em ${base.year}, o ciclo financeiro foi de <strong>${fmtNum(base.cicloFin)} dias</strong>, a NCG de <strong>${fmtBRL(base.ncg)}</strong>, a folga de caixa de <strong>${fmtSignedBRL(base.folgaCaixa)}</strong> e o caixa operacional de <strong>${fmtBRL(base.cxOpInd)}</strong>. Principais sinais: ${issue.join(", ") || "ciclo e liquidez próximos da referência histórica"} <strong>Selecione medidas e avalie os trade-offs.</strong>`;
  document.getElementById("challengeScoreTitle").textContent = `Placar da Decisão (${base.year})`;

  const reducePmre = Math.min(20, Math.max(8, base.pmre * 0.12));
  const reducePmrv = Math.min(15, Math.max(6, base.pmrv * 0.10));
  const extendPmpc = Math.min(12, Math.max(5, base.pmpc * 0.12));
  const actionData = [
    { title: `Reduzir PMRE em ${fmtNum(reducePmre, 0)} dias`, sub: "Programação de compras, giro de estoques e tratamento de itens parados.", pmre: -reducePmre, pmrv: 0, pmpc: 0, risk: 1 },
    { title: `Reduzir PMRV em ${fmtNum(reducePmrv, 0)} dias`, sub: "Cobrança preventiva, limites de crédito e monitoramento de vencimentos.", pmre: 0, pmrv: -reducePmrv, pmpc: 0, risk: 2 },
    { title: `Alongar PMPC em ${fmtNum(extendPmpc, 0)} dias`, sub: "Negociação acordada com fornecedores estratégicos.", pmre: 0, pmrv: 0, pmpc: extendPmpc, risk: 2 },
    { title: "Ação combinada de giro", sub: "Reduzir estoque e recebíveis em conjunto, sem alterar significativamente os fornecedores.", pmre: -reducePmre * 0.5, pmrv: -reducePmrv * 0.5, pmpc: 0, risk: 3 }
  ];

  challengeOptions.innerHTML = actionData.map((a, i) => `
    <div class="decision-card">
      <div>
        <strong>${i + 1}. ${a.title}</strong>
        <div class="kpi-sub">${a.sub}</div>
      </div>
      <input type="checkbox" class="challenge-opt" data-pmre="${a.pmre}" data-pmrv="${a.pmrv}" data-pmpc="${a.pmpc}" data-risk="${a.risk}" />
    </div>
  `).join("");
  document.querySelectorAll(".challenge-opt").forEach(chk => chk.addEventListener("change", updateChallenge));
  updateChallenge();
}

function updateChallenge() {
  const base = DATA.find(d => d.year === Number(challengeYearSelect.value)) || DATA.find(d => d.year === 2022);
  let pmreDelta = 0, pmrvDelta = 0, pmpcDelta = 0, riskScore = 0, selectedCount = 0;

  document.querySelectorAll(".challenge-opt").forEach(chk => {
    if (chk.checked) {
      selectedCount++;
      pmreDelta += Number(chk.dataset.pmre);
      pmrvDelta += Number(chk.dataset.pmrv);
      pmpcDelta += Number(chk.dataset.pmpc);
      riskScore += Number(chk.dataset.risk);
    }
  });

  const res = calcScenarioFromBase(
    base,
    Math.max(10, base.pmre + pmreDelta),
    Math.max(10, base.pmrv + pmrvDelta),
    Math.max(10, base.pmpc + pmpcDelta),
    0
  );
  const cashGain = res.ncgDelta <= 0 ? -res.ncgDelta : 0;
  const finalCash = base.cxOpInd + cashGain;
  const riskText = riskScore <= 1 ? "Baixo" : riskScore <= 3 ? "Moderado" : "Elevado";

  document.getElementById("chalCash").textContent = fmtBRL(finalCash, 1);
  document.getElementById("chalCashGain").textContent = `${fmtSignedBRL(cashGain, 1)} de alívio estimado`;
  document.getElementById("chalCashGain").className = "delta " + (cashGain > 0 ? "pos" : "");
  document.getElementById("chalCycle").textContent = `${fmtNum(res.simCycle)} dias`;
  const riskEl = document.getElementById("chalRiskLabel");
  riskEl.textContent = `Risco operacional: ${riskText}`;
  riskEl.className = "delta " + (riskScore >= 4 ? "neg" : riskScore >= 2 ? "warn" : "pos");

  const fb = document.getElementById("chalFeedback");
  if (selectedCount === 0) {
    fb.className = "callout warn-box";
    fb.innerHTML = `Em ${base.year}, o caixa operacional ficou em ${fmtBRL(base.cxOpInd)} e a folga em ${fmtSignedBRL(base.folgaCaixa)}. Selecione ações para equilibrar liquidez e risco operacional.`;
  } else if (riskScore >= 5) {
    fb.className = "callout warn-box";
    fb.innerHTML = `<strong>Atenção ao excesso de pressão:</strong> a combinação pode liberar ${fmtBRL(cashGain, 1)}, mas elevar o risco operacional. Preserve fornecimento, produção e vendas.`;
  } else {
    fb.className = "callout ok-box";
    fb.innerHTML = `<strong>Estratégia equilibrada:</strong> o ciclo passa para ${fmtNum(res.simCycle)} dias, a NCG para ${fmtBRL(res.simNcg)}, o ST para ${fmtBRL(res.simSt)} e a folga estimada fica em ${fmtSignedBRL(res.simFolga)}. Risco ${riskText.toLowerCase()}.`;
  }
}

challengeYearSelect.addEventListener("change", renderChallengeOptions);

// Aba 5: Problemas Pré-Definidos ligados aos dados reais do Excel
const PREDEFINED_PROBLEMS = [
  {
    id: "estoque_alto",
    title: "1. Excesso de estoques e giro lento (Foco: PMRE)",
    sub: "Simula redução de 12 dias no PMRE por controle de itens parados/baixo giro e programação de compras.",
    tags: ["PMRE", "Estoques"],
    dPmre: -12.0, dPmrv: 0.0, dPmpc: 0.0, disbPct: 0.0,
    actions: [
      "Classificar itens por criticidade e giro (MP, WIP e produtos acabados) e definir estoques mínimo, máximo e de segurança.",
      "Tratar itens parados/obsoletos e alinhar compras e produção à demanda firme sem gerar falta de componentes críticos."
    ],
    risk: "Reduzir estoques sem critério por item pode causar ruptura e parada de linha."
  },
  {
    id: "atraso_clientes",
    title: "2. Atraso de clientes e pressão no recebimento (Foco: PMRV)",
    sub: "Simula redução de 8 dias no PMRV via cobrança preventiva, revisão de crédito e monitoramento de vencimentos.",
    tags: ["PMRV", "Recebíveis e Crédito"],
    dPmre: 0.0, dPmrv: -8.0, dPmpc: 0.0, disbPct: 0.0,
    actions: [
      "Acompanhar vencimentos e faixas de atraso por cliente, reforçando cobrança preventiva e critérios de crédito.",
      "Avaliar políticas de pagamento e antecipação apenas quando o custo financeiro for vantajoso."
    ],
    risk: "Endurecer limites de crédito de forma excessiva pode retrair vendas a prazo."
  },
  {
    id: "prazo_fornecedores",
    title: "3. Prazo curto com fornecedores (Foco: PMPC)",
    sub: "Simula alongamento de +6 dias no PMPC por negociação sustentável com fornecedores estratégicos.",
    tags: ["PMPC", "Fornecedores"],
    dPmre: 0.0, dPmrv: 0.0, dPmpc: 6.0, disbPct: 0.0,
    actions: [
      "Negociar prazos de pagamento alinhados ao ciclo de recebimento com fornecedores estratégicos.",
      "Consolidar compras quando houver ganho real de negociação, evitando excesso de estoque."
    ],
    risk: "Esticar pagamentos sem acordo formal pode prejudicar abastecimento e parcerias."
  },
  {
    id: "lucro_sem_caixa",
    title: "4. Lucro alto com baixa conversão em caixa / folga apertada (Foco: Liquidez, NCG e ST)",
    sub: "Simula redução combinada de 7 dias no PMRE e 5 dias no PMRV com −3% nos desembolsos previstos.",
    tags: ["NCG", "Saldo de Tesouraria", "Caixa Mínimo"],
    dPmre: -7.0, dPmrv: -5.0, dPmpc: 0.0, disbPct: -3.0,
    actions: [
      "Monitorar a conversão Caixa Operacional ÷ Lucro Líquido, a razão NCG ÷ Receita Líquida e a folga frente ao Caixa Mínimo.",
      "Manter projeção semanal/mensal de fluxo de caixa e reserva mínima de liquidez para absorver variações."
    ],
    risk: "Avaliar apenas o lucro contábil sem acompanhar NCG, ST e desembolsos pode gerar aperto de caixa."
  },
  {
    id: "combinado_giro",
    title: "5. Ciclo longo combinado: estoque elevado + atraso de recebíveis (Foco: PMRE e PMRV)",
    sub: "Simula redução de 10 dias no PMRE e 6 dias no PMRV para aliviar NCG e elevar o Saldo de Tesouraria.",
    tags: ["PMRE", "PMRV", "NCG", "ST"],
    dPmre: -10.0, dPmrv: -6.0, dPmpc: 0.0, disbPct: 0.0,
    actions: [
      "Atuar simultaneamente no giro de estoques (PMRE) e na agilidade de cobrança/crédito (PMRV).",
      "Acompanhar o deslocamento entre NCG e Saldo de Tesouraria (ST) mantendo CGL saudável."
    ],
    risk: "Executar cortes simultâneos sem controle de produção e crédito pode afetar o nível de serviço."
  }
];

const stratYearSelect = document.getElementById("stratBaseYear");
const problemListEl = document.getElementById("predefinedProblemsList");
const problemSolutionBox = document.getElementById("problemSolutionBox");

DATA.forEach(d => {
  const opt = document.createElement("option");
  opt.value = d.year;
  opt.textContent = `${d.year} (${d.phase}) — Ciclo: ${fmtNum(d.cicloFin)}d | NCG: ${fmtBRL(d.ncg)} | ST: ${fmtBRL(d.st)} | Folga: ${fmtSignedBRL(d.folgaCaixa)}`;
  if (d.year === 2025) opt.selected = true;
  stratYearSelect.appendChild(opt);
});

problemListEl.innerHTML = PREDEFINED_PROBLEMS.map((p, idx) => `
  <label class="problem-option">
    <input type="radio" name="predefinedProblem" value="${p.id}" ${idx === 0 ? "checked" : ""} />
    <span>
      <span class="problem-title">${p.title}</span>
      <span class="problem-sub">${p.sub}</span>
    </span>
  </label>
`).join("");

function getSelectedProblem() {
  const checked = document.querySelector('input[name="predefinedProblem"]:checked');
  const id = checked ? checked.value : PREDEFINED_PROBLEMS[0].id;
  return PREDEFINED_PROBLEMS.find(p => p.id === id) || PREDEFINED_PROBLEMS[0];
}

function getProblemAdjustments(prob) {
  const pmreInput = document.getElementById("problemPmre");
  const pmrvInput = document.getElementById("problemPmrv");
  const pmpcInput = document.getElementById("problemPmpc");
  const disbInput = document.getElementById("problemDisb");

  return {
    dPmre: pmreInput ? -Math.max(0, Number(pmreInput.value) || 0) : prob.dPmre,
    dPmrv: pmrvInput ? -Math.max(0, Number(pmrvInput.value) || 0) : prob.dPmrv,
    dPmpc: pmpcInput ? Math.max(0, Number(pmpcInput.value) || 0) : prob.dPmpc,
    disbPct: disbInput ? -Math.max(0, Number(disbInput.value) || 0) : prob.disbPct
  };
}

function renderProblemAdjustments(prob) {
  const fields = document.getElementById("problemAdjustmentFields");
  let html = "";

  if (prob.dPmre !== 0) {
    html += `<label>Redução do PMRE (dias)
      <input id="problemPmre" type="number" min="0" max="60" step="1" value="${Math.abs(prob.dPmre)}" />
    </label>`;
  }
  if (prob.dPmrv !== 0) {
    html += `<label>Redução do PMRV (dias)
      <input id="problemPmrv" type="number" min="0" max="60" step="1" value="${Math.abs(prob.dPmrv)}" />
    </label>`;
  }
  if (prob.dPmpc !== 0) {
    html += `<label>Alongamento do PMPC (dias)
      <input id="problemPmpc" type="number" min="0" max="60" step="1" value="${Math.abs(prob.dPmpc)}" />
    </label>`;
  }
  if (prob.disbPct !== 0) {
    html += `<label>Desembolsos (%)
      <input id="problemDisb" type="number" min="0" max="50" step="1" value="${Math.abs(prob.disbPct)}" />
    </label>`;
  }

  fields.innerHTML = html || "<span class=\"kpi-sub\">Este problema não possui ajuste numérico adicional.</span>";
  fields.querySelectorAll("input").forEach(input => input.addEventListener("input", renderProblemResolution));
}

function renderStrategyCards(base, prob) {
  const adjustments = getProblemAdjustments(prob);

  const stockActive = prob.id === "estoque_alto" || prob.id === "combinado_giro";
  const receivableActive = prob.id === "atraso_clientes" || prob.id === "combinado_giro";
  const supplierActive = prob.id === "prazo_fornecedores";
  const cashActive = prob.id === "lucro_sem_caixa";

  document.getElementById("strategyStockFocus").innerHTML =
    `<strong>Foco: PMRE</strong>${stockActive ? ` • Ajuste selecionado: ${Math.abs(adjustments.dPmre)} dias` : " • Não é o foco principal"}`;
  document.getElementById("strategyStockList").innerHTML = stockActive ? `
    <li>Revisar itens parados e obsoletos com inventário ABC/criticidade.</li>
    <li>Alinhar compras e produção à previsão de demanda para o ano ${base.year}.</li>
    <li>Reduzir o PMRE para cerca de ${fmtNum(Math.max(10, base.pmre + adjustments.dPmre))} dias.</li>
    <li>Acompanhar rupturas e nível de serviço por categoria de estoque.</li>
  ` : `
    <li>Manter metas mínimas, máximas e estoques de segurança por criticidade.</li>
    <li>Revisar programação de compras e produção periodicamente.</li>
  `;
  document.getElementById("strategyStockRisk").innerHTML =
    stockActive
      ? `<strong>Risco do ajuste:</strong> redução de ${Math.abs(adjustments.dPmre)} dias pode causar ruptura se não considerar componentes críticos.`
      : `<strong>Risco do ajuste:</strong> reduzir estoques indiscriminadamente pode provocar ruptura e atrasos na produção.`;

  document.getElementById("strategyReceivableFocus").innerHTML =
    `<strong>Foco: PMRV</strong>${receivableActive ? ` • Ajuste selecionado: ${Math.abs(adjustments.dPmrv)} dias` : " • Não é o foco principal"}`;
  document.getElementById("strategyReceivableList").innerHTML = receivableActive ? `
    <li>Monitorar carteira vencida e clientes críticos semanalmente.</li>
    <li>Reforçar cobrança preventiva e revisar limites de crédito.</li>
    <li>Reduzir o PMRV para cerca de ${fmtNum(Math.max(10, base.pmrv + adjustments.dPmrv))} dias.</li>
    <li>Medir perda de vendas antes de endurecer condições comerciais.</li>
  ` : `
    <li>Monitorar vencimentos e atrasos por cliente.</li>
    <li>Revisar limites de crédito e critérios de concessão.</li>
  `;
  document.getElementById("strategyReceivableRisk").innerHTML =
    receivableActive
      ? `<strong>Risco do ajuste:</strong> reduzir o PMRV em ${Math.abs(adjustments.dPmrv)} dias pode afastar clientes se o crédito ficar excessivamente restritivo.`
      : `<strong>Risco do ajuste:</strong> endurecer o crédito pode afastar clientes ou reduzir vendas.`;

  document.getElementById("strategySupplierFocus").innerHTML =
    `<strong>Foco: PMPC</strong>${supplierActive ? ` • Ajuste selecionado: ${Math.abs(adjustments.dPmpc)} dias` : " • Não é o foco principal"}`;
  document.getElementById("strategySupplierList").innerHTML = supplierActive ? `
    <li>Negociar prazos sustentáveis por categoria de fornecedor.</li>
    <li>Elevar o PMPC para cerca de ${fmtNum(Math.max(10, base.pmpc + adjustments.dPmpc))} dias.</li>
    <li>Formalizar acordos sem comprometer fornecedores críticos.</li>
    <li>Priorizar fornecedores com maior impacto na continuidade operacional.</li>
  ` : `
    <li>Negociar prazos compatíveis com o recebimento dos clientes.</li>
    <li>Evitar atrasos que prejudiquem fornecimento ou reputação.</li>
  `;
  document.getElementById("strategySupplierRisk").innerHTML =
    supplierActive
      ? `<strong>Risco do ajuste:</strong> alongar ${Math.abs(adjustments.dPmpc)} dias pode comprometer o fornecimento sem acordo formal.`
      : `<strong>Risco do ajuste:</strong> alongar pagamentos sem acordo pode comprometer fornecedores e continuidade de abastecimento.`;

  document.getElementById("strategyCashFocus").innerHTML =
    `<strong>Foco: liquidez e ST</strong>${cashActive ? ` • Ajuste selecionado: ${Math.abs(adjustments.disbPct)}% nos desembolsos` : " • Monitoramento geral"}`;
  document.getElementById("strategyCashList").innerHTML = cashActive ? `
    <li>Projetar caixa semanalmente considerando desembolsos ajustados em ${Math.abs(adjustments.disbPct)}%.</li>
    <li>Monitorar NCG ÷ Receita, ST e caixa mínimo em ${base.year}.</li>
    <li>Definir reserva mínima com base na folha de pagamento e compromissos críticos.</li>
    <li>Revisar cenários de atraso de vendas e aumento de custos.</li>
  ` : `
    <li>Projetar entradas e saídas semanalmente e mensalmente.</li>
    <li>Estabelecer reserva mínima de liquidez com critérios definidos.</li>
  `;
  document.getElementById("strategyCashBenefit").innerHTML =
    cashActive
      ? `<strong>Benefício esperado:</strong> antecipar o aperto de caixa e medir o efeito da redução de ${Math.abs(adjustments.disbPct)}% nos desembolsos.`
      : `<strong>Benefício esperado:</strong> antecipar períodos de pressão financeira e tomar decisões antes que falte caixa.`;

  const pmreAction = adjustments.dPmre !== 0 ? `Reduzir PMRE em ${Math.abs(adjustments.dPmre)} dias` : "Monitorar PMRE";
  const pmrvAction = adjustments.dPmrv !== 0 ? `Reduzir PMRV em ${Math.abs(adjustments.dPmrv)} dias` : "Monitorar PMRV";
  const pmpcAction = adjustments.dPmpc !== 0 ? `Alongar PMPC em ${Math.abs(adjustments.dPmpc)} dias` : "Revisar PMPC";
  const cashAction = adjustments.disbPct !== 0 ? `Reduzir desembolsos em ${Math.abs(adjustments.disbPct)}%` : "Manter reserva de caixa";

  document.getElementById("actionPlanBody").innerHTML = `
    <tr><td>30 dias</td><td>${prob.id === "estoque_alto" || prob.id === "combinado_giro" ? pmreAction : prob.id === "atraso_clientes" ? pmrvAction : prob.id === "prazo_fornecedores" ? pmpcAction : cashAction}</td><td>${stockActive ? "PMRE" : receivableActive ? "PMRV" : supplierActive ? "PMPC" : "NCG, ST e caixa mínimo"}</td><td>Gerar alívio imediato e medir impacto operacional</td></tr>
    <tr><td>60 dias</td><td>Revisar crédito, compras, cobrança e fornecedores</td><td>PMRE, PMRV e PMPC</td><td>Consolidar o ajuste escolhido no ano ${base.year}</td></tr>
    <tr><td>90 dias</td><td>Validar caixa mínimo, folga e reserva de liquidez</td><td>NCG, ST e fluxo de caixa</td><td>Estabelecer rotina permanente de gestão</td></tr>
  `;
}

function renderManagementPlan(base, prob) {
  const el = document.getElementById("managementPlan");
  if (!el) return;
  const adjustments = getProblemAdjustments(prob);

  let area = "PMRE, PMRV, PMPC e projeção de caixa";
  let action = "Criar painel mensal com tendências dos indicadores e responsáveis por desvio.";
  let target = "Reduzir a pressão sobre NCG sem comprometer a operação.";

  if (prob.id === "estoque_alto" || (prob.id === "combinado_giro")) {
    area = "PMRE, estoque e planejamento de materiais";
    action = "Executar revisão semanal de estoque por ABC/criticidade, definir limites e tratar itens parados.";
    target = `Reduzir PMRE para aproximadamente ${fmtNum(Math.max(10, base.pmre + adjustments.dPmre))} dias.`;
  } else if (prob.id === "atraso_clientes") {
    area = "PMRV, crédito e cobrança";
    action = "Classificar carteira por vencimento e cliente, revisar crédito e aplicar cobrança preventiva.";
    target = `Reduzir PMRV para aproximadamente ${fmtNum(Math.max(10, base.pmrv + adjustments.dPmrv))} dias.`;
  } else if (prob.id === "prazo_fornecedores") {
    area = "PMPC e fornecedores";
    action = "Renegociar prazos por categoria, priorizando parceiros estratégicos e acordo formal.";
    target = `Elevar PMPC para aproximadamente ${fmtNum(Math.max(10, base.pmpc + adjustments.dPmpc))} dias.`;
  } else if (prob.id === "lucro_sem_caixa") {
    area = "NCG, ST, caixa mínimo e conversão caixa/lucro";
    action = "Implantar projeção semanal de caixa e monitorar NCG ÷ Receita, ST e folga frente ao caixa mínimo.";
    target = "Criar reserva de liquidez e reduzir a diferença entre lucro contábil e caixa operacional.";
  }

  el.className = "callout";
  el.innerHTML = `<strong>Plano de gestão baseado no problema solucionado (${base.year})</strong>
    <ul class="rec-list">
      <li><strong>Área principal:</strong> ${area}</li>
      <li><strong>Ação recorrente:</strong> ${action}</li>
      <li><strong>Meta sugerida:</strong> ${target}</li>
      <li><strong>Responsável sugerido:</strong> Financeiro/Tesouraria, Crédito-Cobrança e Suprimentos/Produção, com revisão mensal da diretoria.</li>
    </ul>`;
}

function renderProblemResolution() {
  const base = DATA.find(d => d.year === Number(stratYearSelect.value)) || DATA[DATA.length - 1];
  const prob = getSelectedProblem();
  const adjustments = getProblemAdjustments(prob);

  const newPmre = Math.max(10, base.pmre + adjustments.dPmre);
  const newPmrv = Math.max(10, base.pmrv + adjustments.dPmrv);
  const newPmpc = Math.max(10, base.pmpc + adjustments.dPmpc);

  const res = calcScenarioFromBase(base, newPmre, newPmrv, newPmpc, adjustments.disbPct);
  const adjustmentSummary =
    `${adjustments.dPmre !== 0 ? `PMRE ${fmtSignedNum(adjustments.dPmre, 1, " dias")}; ` : ""}` +
    `${adjustments.dPmrv !== 0 ? `PMRV ${fmtSignedNum(adjustments.dPmrv, 1, " dias")}; ` : ""}` +
    `${adjustments.dPmpc !== 0 ? `PMPC ${fmtSignedNum(adjustments.dPmpc, 1, " dias")}; ` : ""}` +
    `${adjustments.disbPct !== 0 ? `Desembolsos ${adjustments.disbPct}%` : ""}`;

  problemSolutionBox.className = "callout ok-box";
  problemSolutionBox.innerHTML = `
    <div class="tag-row">
      ${prob.tags.map(t => `<span class="focus-tag">${t}</span>`).join("")}
      <span class="focus-tag">Ano-Base: ${base.year}</span>
    </div>
    <strong>${prob.title}</strong>
    <p style="margin-top:6px;">
      Na base real de <strong>${base.year}</strong> (PMRE <strong>${fmtNum(base.pmre)}d</strong>, PMRV <strong>${fmtNum(base.pmrv)}d</strong>, PMPC <strong>${fmtNum(base.pmpc)}d</strong>, Ciclo <strong>${fmtNum(base.cicloFin)}d</strong>, NCG <strong>${fmtBRL(base.ncg)}</strong>, ST <strong>${fmtBRL(base.st)}</strong>, Caixa Mínimo <strong>${fmtBRL(base.caixaMin)}</strong> e Folga de Caixa <strong>${fmtSignedBRL(base.folgaCaixa)}</strong>), a simulação projeta:
    </p>
    <p><strong>Valores informados nesta simulação:</strong> ${adjustmentSummary || "sem alteração pré-definida"}</p>
    <ul class="rec-list">
      <li><strong>Ciclo Financeiro:</strong> de ${fmtNum(base.cicloFin)} dias para <strong>${fmtNum(res.simCycle)} dias</strong> (${fmtSignedNum(res.cycleDiff, 1, " dias")}).</li>
      <li><strong>NCG e Saldo de Tesouraria:</strong> NCG de <strong>${fmtBRL(res.simNcg)}</strong> (${fmtSignedBRL(res.ncgDelta)}) e ST de <strong>${fmtBRL(res.simSt)}</strong> (${fmtSignedBRL(res.stDelta)}).</li>
      <li><strong>Caixa Mínimo e Folga:</strong> Caixa mínimo de <strong>${fmtBRL(res.simMinCash)}</strong> (${fmtSignedBRL(res.minCashDelta)}) e folga projetada de <strong>${fmtSignedBRL(res.simFolga)}</strong> vs. caixa real de ${fmtBRL(base.caixaReal)}.</li>
      ${prob.actions.map(a => `<li>${a}</li>`).join("")}
    </ul>
    <div><strong>Risco do ajuste:</strong> ${prob.risk}</div>
  `;
  renderStrategyCards(base, prob);
  renderManagementPlan(base, prob);
}

document.getElementById("resetProblemBtn").addEventListener("click", () => {
  const firstRadio = document.querySelector('input[name="predefinedProblem"]');
  if (firstRadio) firstRadio.checked = true;
  renderProblemAdjustments(PREDEFINED_PROBLEMS[0]);
  renderProblemResolution();
});
document.querySelectorAll('input[name="predefinedProblem"]').forEach(radio => {
  radio.addEventListener("change", () => {
    renderProblemAdjustments(getSelectedProblem());
    renderProblemResolution();
  });
});
stratYearSelect.addEventListener("change", renderProblemResolution);
cashFlowYearSelect.addEventListener("change", renderCashFlowDashboard);

// Carrega os dados do arquivo exportado da planilha antes de renderizar as abas.
fetch("./Marcopolo_base_calculos_2017_2025.json")
  .then(response => {
    if (!response.ok) throw new Error(`Falha ao carregar o JSON (${response.status})`);
    return response.json();
  })
  .then(workbook => {
    DATA = buildAppData(workbook);
    populateYearOptions();
    renderDiagnostico();
    renderCashFlowDashboard();
    loadYearIntoSliders();
    renderChallengeOptions();
    renderProblemAdjustments(PREDEFINED_PROBLEMS[0]);
    renderProblemResolution();
  })
  .catch(error => {
    console.error("Não foi possível carregar a base de dados:", error);
    document.querySelector(".footer-note").textContent = "Não foi possível carregar os dados. Abra o protótipo por um servidor local ou pela hospedagem do repositório.";
  });