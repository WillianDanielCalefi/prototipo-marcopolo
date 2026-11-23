const SYMBOLS = ["POMO3", "POMO4"];
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";
const MARKET_API_BASE_URL =
  document.querySelector('meta[name="market-api-base-url"]')?.content.trim().replace(/\/+$/, "") || "";

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
const axisCurrencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});
const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const marketTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo"
});
const chartDateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo"
});

function getElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento obrigatório não encontrado: #${id}`);
  return element;
}

function getApiError(status) {
  const messages = {
    401: "BRAPI_TOKEN ausente ou inválido no servidor. Configure a variável de ambiente e reinicie o servidor.",
    403: "Seu plano da brapi não permite consultar esses dados.",
    404: "A brapi não encontrou cotações para os ativos solicitados.",
    429: "Limite de consultas atingido. Aguarde o prazo indicado pela brapi antes de tentar novamente."
  };
  return messages[status] || `A brapi respondeu com erro HTTP ${status}.`;
}

async function requestBrapi(path) {
  let response;
  try {
    response = await fetch(`${MARKET_API_BASE_URL}${path}`, {
      cache: "no-store"
    });
  } catch (error) {
    console.error("Erro de rede ao consultar a API de mercado:", error);
    throw new Error("Falha ao conectar à API de mercado. Verifique o servidor, a URL e a configuração de CORS.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Resposta JSON inválida recebida do servidor de mercado:", error);
    throw new Error("O servidor de mercado retornou uma resposta que não pôde ser lida.");
  }

  if (!response.ok) {
    const apiError = new Error(getApiError(response.status));
    apiError.status = response.status;
    apiError.retryAfter = response.headers.get("Retry-After");
    throw apiError;
  }

  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("A resposta da brapi não contém a lista esperada de resultados.");
  }
  return payload.results;
}

function findSymbolResult(results, symbol) {
  return results.find(result => result.symbol === symbol || result.requestedSymbol === symbol);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatOptionalCurrency(value) {
  return isFiniteNumber(value) ? currencyFormat.format(value) : "—";
}

function formatMarketTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Horário do pregão indisponível" : marketTimeFormat.format(date);
}

function formatSigned(value, formatter) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatter.format(value)}`;
}

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  if (text) element.textContent = text;
  return element;
}

export function initializeStocksTab() {
  const refreshButton = getElement("marketRefreshButton");
  const statusElement = getElement("marketStatus");
  const marketSection = getElement("acoes");
  const marketTabButton = document.querySelector('.tab-btn[data-tab="acoes"]');
  if (!marketTabButton) throw new Error("Botão obrigatório da aba Ações não encontrado.");
  const chartSymbolSelect = getElement("marketChartSymbol");
  const chartRangeSelect = getElement("marketChartRange");
  const chartContainer = getElement("marketChart");
  const chartDescription = getElement("marketChartDescription");

  let busy = false;
  let hasQuoteData = false;
  let retryUntil = 0;
  let retryTimer = null;
  let refreshTimer = null;
  let historyBySymbol = {};
  let lastQuoteUpdate = null;

  function setStatus(message, state = "") {
    statusElement.textContent = message;
    statusElement.classList.toggle("is-error", state === "error");
    statusElement.classList.toggle("is-warning", state === "warning");
  }

  function setBusy(isBusy) {
    busy = isBusy;
    refreshButton.disabled = isBusy || Date.now() < retryUntil;
    chartSymbolSelect.disabled = isBusy || !hasQuoteData;
    chartRangeSelect.disabled = isBusy || !hasQuoteData;
  }

  function applyRetryAfter(value) {
    if (!value) return;
    const seconds = Number(value);
    const retryDelay = Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1000
      : Date.parse(value) - Date.now();
    if (!Number.isFinite(retryDelay) || retryDelay < 0) return;

    retryUntil = Date.now() + retryDelay;
    if (retryTimer) window.clearInterval(retryTimer);
    const updateCountdown = () => {
      const remaining = Math.ceil((retryUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        window.clearInterval(retryTimer);
        retryTimer = null;
        setBusy(false);
        return;
      }
      refreshButton.disabled = true;
      setStatus(`Limite da brapi atingido. Aguarde ${remaining} s antes de tentar novamente.`, "warning");
    };
    updateCountdown();
    retryTimer = window.setInterval(updateCountdown, 1000);
  }

  function renderQuotes(results) {
    const missingSymbols = [];
    for (const symbol of SYMBOLS) {
      const suffix = symbol === "POMO3" ? "Pomo3" : "Pomo4";
      const result = findSymbolResult(results, symbol);
      const priceElement = getElement(`marketPrice${suffix}`);
      const changeElement = getElement(`marketChange${suffix}`);
      if (!result || !result.data) {
        priceElement.textContent = "Sem cotação";
        changeElement.textContent = "A brapi não retornou este ativo.";
        missingSymbols.push(symbol);
        continue;
      }

      const data = result.data;
      const nameElement = getElement(`marketName${suffix}`);
      nameElement.textContent = data.shortName || data.longName || (symbol === "POMO3" ? "Marcopolo ON" : "Marcopolo PN");
      if (!isFiniteNumber(data.regularMarketPrice)) {
        priceElement.textContent = "—";
        changeElement.textContent = "Preço indisponível";
        changeElement.classList.remove("is-positive", "is-negative");
        missingSymbols.push(symbol);
        continue;
      }

      priceElement.textContent = currencyFormat.format(data.regularMarketPrice);
      getElement(`marketTime${suffix}`).textContent = data.regularMarketTime
        ? `Pregão: ${formatMarketTime(data.regularMarketTime)}`
        : "Horário do pregão indisponível";
      getElement(`marketHigh${suffix}`).textContent = formatOptionalCurrency(data.regularMarketDayHigh);
      getElement(`marketLow${suffix}`).textContent = formatOptionalCurrency(data.regularMarketDayLow);
      getElement(`marketPrevious${suffix}`).textContent = formatOptionalCurrency(data.regularMarketPreviousClose);
      getElement(`marketVolume${suffix}`).textContent = isFiniteNumber(data.regularMarketVolume)
        ? numberFormat.format(data.regularMarketVolume)
        : "—";

      if (isFiniteNumber(data.regularMarketChange) && isFiniteNumber(data.regularMarketChangePercent)) {
        const changeText = formatSigned(data.regularMarketChange, currencyFormat);
        const percentText = formatSigned(data.regularMarketChangePercent, percentFormat);
        changeElement.textContent = `${changeText} (${percentText}%)`;
        changeElement.classList.toggle("is-positive", data.regularMarketChange > 0);
        changeElement.classList.toggle("is-negative", data.regularMarketChange < 0);
      } else {
        changeElement.textContent = "Variação indisponível";
        changeElement.classList.remove("is-positive", "is-negative");
      }
    }
    return missingSymbols;
  }

  function showEmptyChart(message) {
    const paragraph = document.createElement("p");
    paragraph.className = "market-chart-empty";
    paragraph.textContent = message;
    chartContainer.replaceChildren(paragraph);
  }

  function renderHistoryChart() {
    const symbol = chartSymbolSelect.value;
    const rows = historyBySymbol[symbol] || [];
    if (!rows.length) {
      showEmptyChart(`Não há histórico disponível para ${symbol} neste período.`);
      chartDescription.textContent = "O histórico diário será exibido após uma consulta bem-sucedida.";
      return;
    }

    const values = rows.map(row => row.close);
    const dataMinimum = Math.min(...values);
    const dataMaximum = Math.max(...values);
    const paddingValue = (dataMaximum - dataMinimum) || Math.max(dataMaximum * 0.02, 0.01);
    const minimum = dataMinimum - paddingValue * 0.12;
    const maximum = dataMaximum + paddingValue * 0.12;
    const width = 720;
    const height = 280;
    const margins = { top: 20, right: 20, bottom: 42, left: 82 };
    const plotWidth = width - margins.left - margins.right;
    const plotHeight = height - margins.top - margins.bottom;
    const points = rows.map((row, index) => ({
      x: margins.left + index / Math.max(rows.length - 1, 1) * plotWidth,
      y: margins.top + (maximum - row.close) / (maximum - minimum) * plotHeight,
      row
    }));

    const svg = svgElement("svg", {
      class: "market-chart-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `Histórico diário de fechamento de ${symbol}`
    });
    svg.appendChild(svgElement("title", {}, `Histórico de ${symbol}`));

    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const y = margins.top + fraction * plotHeight;
      const value = maximum - fraction * (maximum - minimum);
      svg.appendChild(svgElement("line", {
        class: "market-chart-grid",
        x1: margins.left,
        x2: width - margins.right,
        y1: y,
        y2: y
      }));
      svg.appendChild(svgElement("text", {
        class: "market-chart-axis",
        x: margins.left - 10,
        y: y + 4,
        "text-anchor": "end"
      }, axisCurrencyFormat.format(value)));
    }

    const path = points.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    ).join(" ");
    svg.appendChild(svgElement("path", { class: "market-chart-line", d: path }));

    for (const point of points) {
      const date = new Date(point.row.date * 1000);
      const circle = svgElement("circle", {
        class: "market-chart-point",
        cx: point.x,
        cy: point.y,
        r: 2.5
      });
      circle.appendChild(svgElement("title", {}, `${date.toLocaleDateString("pt-BR")}: ${currencyFormat.format(point.row.close)}`));
      svg.appendChild(circle);
    }

    const labelIndices = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    for (const index of labelIndices) {
      const point = points[index];
      svg.appendChild(svgElement("text", {
        class: "market-chart-axis",
        x: point.x,
        y: height - 12,
        "text-anchor": index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"
      }, chartDateFormat.format(new Date(point.row.date * 1000))));
    }

    chartContainer.replaceChildren(svg);
    chartDescription.textContent =
      `${symbol} · ${rows.length} pregões · Preços diários de fechamento retornados pela brapi.`;
  }

  function renderHistory(results) {
    const missingSymbols = [];
    historyBySymbol = {};
    for (const symbol of SYMBOLS) {
      const result = findSymbolResult(results, symbol);
      const historicalRows = result && result.data && result.data.historicalDataPrice;
      if (!Array.isArray(historicalRows)) {
        historyBySymbol[symbol] = [];
        missingSymbols.push(symbol);
        continue;
      }

      historyBySymbol[symbol] = historicalRows
        .filter(row => row && typeof row === "object")
        .map(row => ({
          date: isFiniteNumber(row.date) ? row.date : null,
          close: isFiniteNumber(row.close) ? row.close : null
        }))
        .filter(row => row.date !== null && row.close !== null)
        .sort((left, right) => left.date - right.date);
      if (!historyBySymbol[symbol].length) missingSymbols.push(symbol);
    }
    renderHistoryChart();
    return missingSymbols;
  }

  function renderStatus(quoteMissing, historyMissing = [], historyError = "") {
    const updatedAt = lastQuoteUpdate ? marketTimeFormat.format(lastQuoteUpdate) : "—";
    const messages = [`Cotação consultada em ${updatedAt}. Atualização automática a cada 15 minutos enquanto a página e a aba Ações estiverem visíveis.`];
    if (quoteMissing.length) messages.push(`Sem cotação: ${quoteMissing.join(", ")}.`);
    if (historyMissing.length) messages.push(`Sem histórico: ${historyMissing.join(", ")}.`);
    if (historyError) messages.push(`Falha ao carregar o histórico: ${historyError}`);
    setStatus(messages.join(" "), quoteMissing.length || historyMissing.length || historyError ? "warning" : "");
  }

  async function loadMarketData(includeHistory) {
    if (busy || Date.now() < retryUntil) return false;
    setBusy(true);
    let quoteMissing;
    try {
      const quoteQuery = new URLSearchParams({ symbols: SYMBOLS.join(",") });
      const quoteResults = await requestBrapi(`/api/market/quote?${quoteQuery}`);
      quoteMissing = renderQuotes(quoteResults);
      lastQuoteUpdate = new Date();
      hasQuoteData = true;
    } catch (error) {
      console.error("Falha ao carregar cotações de mercado:", error);
      if (error.status === 429) applyRetryAfter(error.retryAfter);
      setStatus(error.message, "error");
      setBusy(false);
      return false;
    }

    let historyMissing = [];
    let historyError = "";
    if (includeHistory) {
      const range = chartRangeSelect.value;
      try {
        const historyQuery = new URLSearchParams({
          symbols: SYMBOLS.join(","),
          range
        });
        const historyResults = await requestBrapi(`/api/market/historical?${historyQuery}`);
        historyMissing = renderHistory(historyResults);
      } catch (error) {
        console.error("Falha ao carregar histórico de mercado:", error);
        if (error.status === 429) applyRetryAfter(error.retryAfter);
        historyError = error.message;
      }
    }

    renderStatus(quoteMissing, historyMissing, historyError);
    setBusy(false);
    return true;
  }

  async function loadHistoryOnly() {
    if (busy || !hasQuoteData || Date.now() < retryUntil) return;
    setBusy(true);
    try {
      const historyQuery = new URLSearchParams({
        symbols: SYMBOLS.join(","),
        range: chartRangeSelect.value
      });
      const historyResults = await requestBrapi(`/api/market/historical?${historyQuery}`);
      const missingSymbols = renderHistory(historyResults);
      renderStatus([], missingSymbols);
    } catch (error) {
      console.error("Falha ao carregar histórico de mercado:", error);
      if (error.status === 429) applyRetryAfter(error.retryAfter);
      setStatus(`Não foi possível atualizar o histórico: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  marketTabButton.addEventListener("click", async () => {
    if (hasQuoteData || busy) return;
    const loaded = await loadMarketData(true);
    if (loaded && !refreshTimer) {
      refreshTimer = window.setInterval(() => {
        if (document.visibilityState === "visible" && marketSection.classList.contains("active")) {
          void loadMarketData(false);
        }
      }, AUTO_REFRESH_MS);
    }
  });

  refreshButton.addEventListener("click", () => void loadMarketData(true));
  chartRangeSelect.addEventListener("change", () => void loadHistoryOnly());
  chartSymbolSelect.addEventListener("change", renderHistoryChart);
}
