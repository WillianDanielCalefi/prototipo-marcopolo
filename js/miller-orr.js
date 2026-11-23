import { fmtBRL, fmtNum } from "./formatters.js";

const DAYS_PER_YEAR = 360;
const DEFAULTS = {
  lowerLimit: 50,
  transactionCost: 0.01,
  dailyStdDev: 20,
  annualOpportunityRate: 12,
  currentCash: 70
};

export function calculateMillerOrr({
  lowerLimit,
  transactionCost,
  dailyStdDev,
  annualOpportunityRate,
  currentCash
}) {
  const values = [lowerLimit, transactionCost, dailyStdDev, annualOpportunityRate, currentCash];
  if (!values.every(Number.isFinite)) {
    throw new Error("Preencha todos os campos com valores numéricos válidos.");
  }
  if (lowerLimit < 0 || currentCash < 0) {
    throw new Error("O limite inferior e o saldo atual não podem ser negativos.");
  }
  if (transactionCost <= 0 || dailyStdDev <= 0 || annualOpportunityRate <= 0) {
    throw new Error("Custo por operação, desvio-padrão e taxa anual devem ser maiores que zero.");
  }

  const dailyOpportunityRate = Math.pow(1 + annualOpportunityRate / 100, 1 / DAYS_PER_YEAR) - 1;
  const variance = dailyStdDev ** 2;
  const spread = Math.cbrt((3 * transactionCost * variance) / (4 * dailyOpportunityRate));
  const returnPoint = lowerLimit + spread;
  const upperLimit = 3 * returnPoint - 2 * lowerLimit;

  if (![dailyOpportunityRate, variance, spread, returnPoint, upperLimit].every(Number.isFinite)) {
    throw new Error("Os valores informados excedem o intervalo que pode ser calculado.");
  }

  return {
    lowerLimit,
    dailyOpportunityRate,
    spread,
    returnPoint,
    upperLimit,
    currentCash
  };
}

function setMarkerPosition(marker, value, scaleMaximum) {
  const position = Math.min(100, Math.max(0, value / scaleMaximum * 100));
  marker.style.setProperty("--miller-position", `${position}%`);
  return position;
}

export function initializeMillerOrr() {
  const inputs = {
    lowerLimit: document.getElementById("millerLowerLimit"),
    transactionCost: document.getElementById("millerTransactionCost"),
    dailyStdDev: document.getElementById("millerDailyStdDev"),
    annualOpportunityRate: document.getElementById("millerAnnualOpportunityRate"),
    currentCash: document.getElementById("millerCurrentCash")
  };
  const outputIds = [
    "millerSpread", "millerReturnPoint", "millerUpperLimit",
    "millerVisualLower", "millerVisualReturn", "millerVisualUpper", "millerVisualCurrent"
  ];
  const outputs = Object.fromEntries(outputIds.map(id => [id, document.getElementById(id)]));
  const visual = document.getElementById("millerOrrVisual");
  const track = visual.querySelector(".miller-orr-track");
  const decision = document.getElementById("millerOrrDecision");
  const dailyRate = document.getElementById("millerOrrDailyRate");
  const markers = {
    lower: document.getElementById("millerLowerMarker"),
    returnPoint: document.getElementById("millerReturnMarker"),
    upper: document.getElementById("millerUpperMarker"),
    current: document.getElementById("millerCurrentMarker")
  };

  function clearResults(message) {
    Object.values(outputs).forEach(output => {
      output.textContent = "—";
    });
    visual.hidden = true;
    decision.className = "callout warn-box";
    decision.textContent = message;
    dailyRate.textContent = "";
  }

  function render() {
    const parameters = Object.fromEntries(
      Object.entries(inputs).map(([name, input]) => [name, input.valueAsNumber])
    );

    let result;
    try {
      result = calculateMillerOrr(parameters);
    } catch (error) {
      clearResults(error.message);
      return;
    }

    outputs.millerSpread.textContent = fmtBRL(result.spread);
    outputs.millerReturnPoint.textContent = fmtBRL(result.returnPoint);
    outputs.millerUpperLimit.textContent = fmtBRL(result.upperLimit);
    outputs.millerVisualLower.textContent = fmtBRL(result.lowerLimit);
    outputs.millerVisualReturn.textContent = fmtBRL(result.returnPoint);
    outputs.millerVisualUpper.textContent = fmtBRL(result.upperLimit);
    outputs.millerVisualCurrent.textContent = fmtBRL(result.currentCash);

    const scaleMaximum = Math.max(result.upperLimit, result.currentCash, 1) * 1.08;
    const lowerPosition = setMarkerPosition(markers.lower, result.lowerLimit, scaleMaximum);
    const returnPosition = setMarkerPosition(markers.returnPoint, result.returnPoint, scaleMaximum);
    const upperPosition = setMarkerPosition(markers.upper, result.upperLimit, scaleMaximum);
    setMarkerPosition(markers.current, result.currentCash, scaleMaximum);
    track.style.setProperty("--miller-l-position", `${lowerPosition}%`);
    track.style.setProperty("--miller-h-position", `${upperPosition}%`);
    visual.setAttribute(
      "aria-label",
      `Faixa Miller–Orr: limite inferior ${fmtBRL(result.lowerLimit)}, ponto de retorno ${fmtBRL(result.returnPoint)}, limite superior ${fmtBRL(result.upperLimit)} e saldo atual ${fmtBRL(result.currentCash)}`
    );
    visual.hidden = false;
    dailyRate.textContent = `Taxa diária efetiva equivalente: ${fmtNum(result.dailyOpportunityRate * 100, 4)}%.`;

    if (result.currentCash <= result.lowerLimit) {
      const amountToRaise = result.returnPoint - result.currentCash;
      decision.className = "callout warn-box";
      decision.textContent = `O saldo está no limite inferior ou abaixo dele. Recompor ${fmtBRL(amountToRaise)} para retornar ao ponto Z (${fmtBRL(result.returnPoint)}).`;
    } else if (result.currentCash >= result.upperLimit) {
      const amountToInvest = result.currentCash - result.returnPoint;
      decision.className = "callout ok-box";
      decision.textContent = `O saldo atingiu ou ultrapassou o limite superior. Aplicar ${fmtBRL(amountToInvest)} para retornar ao ponto Z (${fmtBRL(result.returnPoint)}).`;
    } else {
      decision.className = "callout ok-box";
      decision.textContent = `O saldo está entre L e H. Não realizar operação neste momento; o modelo indica agir ao atingir um dos limites.`;
    }
  }

  Object.values(inputs).forEach(input => input.addEventListener("input", render));
  document.getElementById("resetMillerOrr").addEventListener("click", () => {
    for (const [name, value] of Object.entries(DEFAULTS)) {
      inputs[name].value = String(value);
    }
    render();
  });

  render();
}
