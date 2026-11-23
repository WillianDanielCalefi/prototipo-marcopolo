# Protótipo Marcopolo

Protótipo interativo para análise do capital de giro da Marcopolo entre 2017 e 2025. A aplicação foi feita com HTML, CSS e JavaScript, sem framework ou banco de dados.

## Conteúdo

- Diagnóstico dos indicadores por ano;
- simulador de capital de giro;
- simulador didático do modelo de caixa Miller–Orr;
- desafio CFO;
- conceitos e indicadores;
- estratégias de gestão;
- comparativo entre os períodos pré-pandemia, durante a pandemia e pós-pandemia;
- acompanhamento das ações POMO3 e POMO4, com cotações e histórico pela brapi;
- temas claro e escuro, com preferência salva no navegador;
- visualização histórica em barras ou linha para ciclo financeiro, NCG e saldo de tesouraria.

Os valores monetários são apresentados em reais milhões. Os indicadores usam ano-base de 360 dias. A base considera o segmento industrial; dados de aging e composição dos estoques são consolidados, conforme as premissas da planilha.

### Simulação Miller–Orr

O módulo dentro do **Simulador de Capital de Giro** calcula a amplitude ótima, o ponto de retorno e o limite superior a partir do limite mínimo de caixa, custo por operação, desvio-padrão diário dos fluxos líquidos e custo de oportunidade efetivo anual. A taxa anual é convertida em taxa diária equivalente usando a base de 360 dias. Os valores iniciais são exemplos didáticos e devem ser substituídos por premissas reais; os dados anuais da planilha não permitem estimar a variância diária necessária para uma aplicação operacional.

## Arquivos

- `index.html`: estrutura da interface e ponto de entrada;
- `css/styles.css`: estilos da aplicação;
- `js/app.js`: inicialização, renderização das abas e interações;
- `js/miller-orr.js`: cálculo e interação da simulação Miller–Orr;
- `js/stocks.js`: consulta e renderização das cotações e do histórico via brapi;
- `js/data.js`: conversão dos dados do JSON para o formato usado pela interface;
- `js/formatters.js`: formatação de números e valores monetários;
- `assets/`: banner institucional usado no cabeçalho e arquivos de marca;
- `Marcopolo_base_calculos_2017_2025.json`: dados carregados pela aplicação, exportados das abas `Dados`, `Indicadores` e `Premissas`;
- `Marcopolo_base_calculos_2017_2025.xlsx`: planilha original, mantida como fonte e referência para conferência.

O site usa o JSON. A planilha Excel não é necessária para executar a aplicação. Os ícones são fornecidos pela biblioteca Lucide 0.468.0 via CDN; é necessária conexão à internet para carregá-los.

### Cotações da brapi

A aba **Ações** consulta POMO3 e POMO4 pela API PHP independente em `C:\projetos\api-brapi-marcopolo`. A API chama os endpoints `/api/v2/stocks/quote` e `/api/v2/stocks/historical`; o front envia um ativo por requisição para funcionar também no plano gratuito da brapi. A API lê `BRAPI_TOKEN` do ambiente do servidor e envia `Authorization: Bearer <BRAPI_TOKEN>`; a chave não é incluída no HTML, JavaScript ou repositório. As cotações são atualizadas automaticamente a cada 15 minutos enquanto a página e a aba Ações estão visíveis, e o histórico pode ser consultado em janelas de 1 ou 3 meses.

Os cartões mostram abertura, faixa de 52 semanas e valor de mercado da Marcopolo. O histórico inclui candles OHLC e volume diário; um gráfico separado compara o retorno percentual de POMO3 e POMO4 usando fechamento ajustado quando disponível.

O servidor encaminha erros HTTP 401, 404 e 429 da brapi. Em caso de 429, ele repassa `Retry-After` e a interface bloqueia novas tentativas até o prazo indicado. Campos numéricos nulos são apresentados como indisponíveis; pontos históricos sem data ou fechamento são omitidos. Sem chave, a brapi permite testar PETR4, VALE3, MGLU3 e ITUB4; POMO3/POMO4 exigem um token válido.

## Como executar

O navegador precisa carregar a aplicação por HTTP; não abra o `index.html` diretamente como arquivo (`file://`).

### Iniciar a API

Siga o README da API em `C:\projetos\api-brapi-marcopolo` para iniciar o servidor PHP em `http://localhost:8080`. A URL já está configurada em `market-api-base-url` no `index.html`.

### Servir o frontend localmente

Use a extensão **Live Server** do VS Code para abrir `index.html` (normalmente em `http://127.0.0.1:5500`). A API PHP permite essa origem por padrão para desenvolvimento local.

Em produção, altere `market-api-base-url` para a URL HTTPS da API e configure `CORS_ALLOWED_ORIGINS` nela com a origem exata do frontend.

## Dados

O módulo `js/data.js` lê `Marcopolo_base_calculos_2017_2025.json` e converte as linhas das abas `Dados` e `Indicadores` para o formato usado nos gráficos e simuladores. As células com fórmulas no JSON guardam a fórmula e o valor calculado que estava salvo na planilha.

Se os dados forem atualizados, atualize também o JSON e mantenha a estrutura de abas e células esperada pelo código. A planilha contém as premissas e observações usadas na interpretação dos indicadores.
