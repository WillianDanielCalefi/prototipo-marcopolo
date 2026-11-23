# Protótipo Marcopolo

Protótipo interativo para análise do capital de giro da Marcopolo entre 2017 e 2025. A aplicação foi feita com HTML, CSS e JavaScript, sem framework ou banco de dados.

## Conteúdo

- Diagnóstico dos indicadores por ano;
- simulador de capital de giro;
- desafio CFO;
- conceitos e indicadores;
- estratégias de gestão;
- comparativo entre os períodos pré-pandemia, durante a pandemia e pós-pandemia;
- acompanhamento das ações POMO3 e POMO4, com cotações e histórico pela brapi;
- temas claro e escuro, com preferência salva no navegador;
- visualização histórica em barras ou linha para ciclo financeiro, NCG e saldo de tesouraria.

Os valores monetários são apresentados em reais milhões. Os indicadores usam ano-base de 360 dias. A base considera o segmento industrial; dados de aging e composição dos estoques são consolidados, conforme as premissas da planilha.

## Arquivos

- `index.html`: estrutura da interface e ponto de entrada;
- `css/styles.css`: estilos da aplicação;
- `js/app.js`: inicialização, renderização das abas e interações;
- `js/stocks.js`: consulta e renderização das cotações e do histórico via brapi;
- `js/data.js`: conversão dos dados do JSON para o formato usado pela interface;
- `js/formatters.js`: formatação de números e valores monetários;
- `assets/`: banner institucional usado no cabeçalho e arquivos de marca;
- `Marcopolo_base_calculos_2017_2025.json`: dados carregados pela aplicação, exportados das abas `Dados`, `Indicadores` e `Premissas`;
- `Marcopolo_base_calculos_2017_2025.xlsx`: planilha original, mantida como fonte e referência para conferência.

O site usa o JSON. A planilha Excel não é necessária para executar a aplicação. Os ícones são fornecidos pela biblioteca Lucide 0.468.0 via CDN; é necessária conexão à internet para carregá-los.

### Cotações da brapi

A aba **Ações** consulta POMO3 e POMO4 pelos endpoints `/api/v2/stocks/quote` e `/api/v2/stocks/historical`. Cada chamada envia os dois ativos no parâmetro `symbols`. O proxy em `server.ps1` lê `BRAPI_TOKEN` do ambiente do servidor e envia `Authorization: Bearer <BRAPI_TOKEN>`; a chave nunca é incluída no HTML, JavaScript ou repositório. As cotações são atualizadas automaticamente a cada 15 minutos enquanto a página e a aba Ações estão visíveis, e o histórico pode ser consultado em janelas de 1 ou 3 meses.

O servidor encaminha erros HTTP 401, 404 e 429 da brapi. Em caso de 429, ele repassa `Retry-After` e a interface bloqueia novas tentativas até o prazo indicado. Campos numéricos nulos são apresentados como indisponíveis; pontos históricos sem data ou fechamento são omitidos. Sem chave, a brapi permite testar PETR4, VALE3, MGLU3 e ITUB4; POMO3/POMO4 exigem um token válido.

## Como executar

O navegador precisa carregar a aplicação por HTTP; não abra o `index.html` diretamente como arquivo (`file://`). Para usar o proxy PowerShell integrado, siga as instruções abaixo. O Live Server sozinho não fornece as rotas do proxy.

### Windows PowerShell

Na pasta do projeto, configure a chave de forma interativa e inicie o servidor:

```powershell
$secureToken = Read-Host "Chave da brapi" -AsSecureString
$env:BRAPI_TOKEN = (New-Object System.Net.NetworkCredential("", $secureToken)).Password
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Abra `http://localhost:8000`. A variável é lida pelo servidor no início do processo; reinicie-o após trocar o token. Para consultar PETR4/VALE3 sem token, basta executar `.\server.ps1`.

### Usar a API PHP separada

O projeto PHP independente fica em `C:\projetos\api-brapi-marcopolo`. Consulte o README dessa pasta para executar ou publicar a API. Para apontar esta aplicação para ela, altere o valor de `market-api-base-url` no `<head>` do `index.html` para a origem da API, por exemplo `http://localhost:8080`. Em producao, use a URL HTTPS da hospedagem PHP e configure `CORS_ALLOWED_ORIGINS` com a origem exata deste frontend.

## Dados

O módulo `js/data.js` lê `Marcopolo_base_calculos_2017_2025.json` e converte as linhas das abas `Dados` e `Indicadores` para o formato usado nos gráficos e simuladores. As células com fórmulas no JSON guardam a fórmula e o valor calculado que estava salvo na planilha.

Se os dados forem atualizados, atualize também o JSON e mantenha a estrutura de abas e células esperada pelo código. A planilha contém as premissas e observações usadas na interpretação dos indicadores.
