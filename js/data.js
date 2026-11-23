// Dados reais extraídos de Marcopolo_base_calculos_2017_2025.xlsx
// Valores monetários convertidos de R$ mil para R$ milhões (÷ 1000), base 360 dias.
// Converte as abas do JSON exportado da planilha para o formato usado pela interface.
export function buildAppData(workbook) {
  const sheets = Object.fromEntries(workbook.sheets.map(sheet => [sheet.name, sheet]));
  const dataSheet = sheets.Dados;
  const indicatorsSheet = sheets.Indicadores;
  const yearColumns = ["B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const cell = (sheet, rowNumber, column) => {
    const row = sheet.rows.find(item => item.row === rowNumber);
    const value = row?.cells?.[column];
    return value && typeof value === "object" && "value" in value ? value.value : value;
  };
  const rawRows = {
    caixaEquiv: 6, cdbCirc: 7, derivAtivo: 8, clientesCirc: 9, clientesNc: 10,
    estoques: 11, outrasRecCirc: 12, fornecedores: 13, empCirc: 14, arrendCirc: 15,
    derivPassivo: 16, outrasPagCirc: 17, divMinPagar: 18, acIndRep: 19, pcIndRep: 20,
    recLiqInd: 27, cpvInd: 28, despVendasInd: 29, despAdmInd: 30,
    outrasRecDespInd: 31, deprAmortInd: 32, lucroLiqInd: 33, cxOpInd: 34, estInicial: 45
  };
  const indicatorRows = {
    pmrv: 6, pmre: 7, compras: 8, pmpc: 9, cicloOp: 10, cicloFin: 11,
    aco: 14, acf: 15, pco: 16, pcf: 17, ncg: 18, st: 19, cgl: 20,
    ncgPctRec: 21, convCxLucro: 26, outrasOpLucro: 27, desembolsos: 30,
    giroCaixa: 31, caixaMin: 32, caixaReal: 33, folgaCaixa: 34,
    vencidoPct: 39, vencido90Pct: 40, coberturaPdd: 41, pddPctCart: 42,
    estPaPct: 45, estWipPct: 46, estMpPct: 47,
    giroRecebiveis: 50, giroEstoques: 51, giroFornecedores: 52, cicloEcon: 53,
    plIndustrial: 56, ancIndustrial: 57, cgp: 58, cgpPctCgl: 59, cglPctRec: 60,
    cfo: 64, cfi: 65, cff: 66, efeitoCambial: 67, variacaoCaixa: 68,
    caixaLivre: 69, capex: 70, captacaoLiquida: 71, jurosPagos: 72,
    dividendosPagos: 73, arrendamentosPagos: 74, outrosFluxos: 75,
    payoutDividendos: 76, pmrvSaldoMedio: 79, pmreSaldoMedio: 80,
    pmpcSaldoMedio: 81, cicloFinSaldoMedio: 82, diferencaCicloMedio: 83
  };
  const moneyFields = new Set([
    "caixaEquiv", "cdbCirc", "derivAtivo", "clientesCirc", "clientesNc", "estoques",
    "outrasRecCirc", "fornecedores", "empCirc", "arrendCirc", "derivPassivo",
    "outrasPagCirc", "divMinPagar", "acIndRep", "pcIndRep", "recLiqInd", "cpvInd",
    "despVendasInd", "despAdmInd", "outrasRecDespInd", "deprAmortInd", "lucroLiqInd",
    "cxOpInd", "estInicial", "compras", "aco", "acf", "pco", "pcf", "ncg", "st",
    "cgl", "desembolsos", "caixaMin", "caixaReal", "folgaCaixa", "plIndustrial",
    "ancIndustrial", "cgp", "cfo", "cfi", "cff", "efeitoCambial", "variacaoCaixa",
    "caixaLivre", "capex", "captacaoLiquida", "jurosPagos", "dividendosPagos",
    "arrendamentosPagos", "outrosFluxos"
  ]);

  return yearColumns.map((column, index) => {
    const sourcePhase = cell(dataSheet, 3, column);
    const row = {
      year: Number(cell(dataSheet, 4, column)),
      phase: sourcePhase === "Pré-pandemia" ? "Pré" : sourcePhase === "Pós-pandemia" ? "Pós" : "Pandemia"
    };
    for (const [field, rowNumber] of Object.entries(rawRows)) {
      row[field] = Number(cell(dataSheet, rowNumber, column)) / 1000;
    }
    for (const [field, rowNumber] of Object.entries(indicatorRows)) {
      const value = Number(cell(indicatorsSheet, rowNumber, column));
      row[field] = moneyFields.has(field) ? value / 1000 : value;
    }
    return row;
  });
}

