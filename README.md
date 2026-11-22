# Protótipo Marcopolo

Protótipo interativo para análise do capital de giro da Marcopolo entre 2017 e 2025. A aplicação foi feita com HTML, CSS e JavaScript, sem dependências de framework ou banco de dados.

## Conteúdo

- Diagnóstico dos indicadores por ano;
- simulador de capital de giro;
- desafio CFO;
- conceitos e indicadores;
- estratégias de gestão;
- comparativo entre os períodos pré-pandemia, durante a pandemia e pós-pandemia.

Os valores monetários são apresentados em reais milhões. Os indicadores usam ano-base de 360 dias. A base considera o segmento industrial; dados de aging e composição dos estoques são consolidados, conforme as premissas da planilha.

## Arquivos

- `index.html`: interface e cálculos do protótipo;
- `Marcopolo_base_calculos_2017_2025.json`: dados carregados pela aplicação, exportados das abas `Dados`, `Indicadores` e `Premissas` da planilha atualizada;
- `Marcopolo_base_calculos_2017_2025_v2 (1).xlsx`: planilha atualizada usada como fonte do JSON;
- `Marcopolo_base_calculos_2017_2025.xlsx`: versão anterior da planilha, mantida para referência.

O site usa o JSON. A planilha Excel não é necessária para executar a aplicação.

## Como executar

O navegador precisa carregar o JSON por HTTP. Por isso, não abra o `index.html` diretamente como arquivo (`file://`).

### VS Code

1. Abra a pasta do projeto no VS Code.
2. Instale a extensão **Live Server**, caso ainda não esteja instalada.
3. Clique com o botão direito em `index.html` e escolha **Open with Live Server**.

### Python

Na pasta do projeto, execute:

```bash
python -m http.server 8000
```

Depois, abra `http://localhost:8000` no navegador.

## Dados

O `index.html` lê `Marcopolo_base_calculos_2017_2025.json` e converte as linhas das abas `Dados` e `Indicadores` para o formato usado nos gráficos e simuladores. As células com fórmulas no JSON guardam a fórmula e o valor calculado que estava salvo na planilha.

Se os dados forem atualizados, atualize também o JSON e mantenha a estrutura de abas e células esperada pelo código. A planilha contém as premissas e observações usadas na interpretação dos indicadores.
