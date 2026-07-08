# Telemetria e diagnóstico

Este projeto possui uma camada simples de telemetria para ajudar a diagnosticar problemas de autenticação, App Check, Pluggy, Data Connect, navegação e desempenho percebido.

## Como funciona

O frontend registra eventos por `src/services/telemetry.ts` e envia lotes pequenos para `/api/telemetry` usando `navigator.sendBeacon`. Quando `sendBeacon` não está disponível, o serviço usa `fetch` com `keepalive`.

A função `functions/api/telemetry.ts` recebe os eventos no Cloudflare Pages, remove dados sensíveis e grava um log estruturado com o tipo `ifinanca.telemetry`. Opcionalmente, ela pode encaminhar o mesmo envelope para uma API externa.

## Eventos principais

- `app.started`: inicialização da aplicação.
- `route.view`: visualização de home, login, cadastro ou dashboard.
- `runtime.error` e `runtime.unhandled_rejection`: erros globais do navegador.
- `performance.navigation`, `performance.lcp` e `performance.cls`: métricas de carregamento e estabilidade visual.
- `auth.submit`, `auth.success`, `auth.error`: login, cadastro e Google.
- `app_check.warmup`, `app_check.retry`, `app_check.retry_result`: estado do App Check.
- `pluggy.connect_started`, `pluggy.connect_finished`, `pluggy.data_loaded`, `pluggy.data_error`: fluxo Pluggy.
- `dataconnect.transactions_loaded` e `dataconnect.transactions_error`: sincronização de transações.
- `dashboard.balance_visibility_changed` e `dashboard.tab_changed`: ações relevantes de uso.

## Privacidade

A telemetria não deve armazenar senha, token, segredo, chave de API, credencial ou autorização. O frontend e a Function aplicam sanitização por chave e substituem e-mails por `[email]`.

Mesmo com essa proteção, evite adicionar propriedades com dados financeiros detalhados, documentos pessoais ou identificadores bancários completos.

## Variáveis de ambiente

### Frontend

```sh
VITE_TELEMETRY_ENABLED=
VITE_TELEMETRY_DEBUG=false
VITE_TELEMETRY_ENDPOINT=/api/telemetry
VITE_APP_VERSION=
```

`VITE_TELEMETRY_ENABLED=true` força o envio em desenvolvimento. `false` desliga o envio mesmo em produção. Quando vazio, a telemetria envia eventos em build de produção.

`VITE_TELEMETRY_DEBUG=true` imprime os eventos no console do navegador antes do envio.

### Cloudflare Pages Functions

```sh
TELEMETRY_INGEST_URL=
TELEMETRY_INGEST_TOKEN=
```

Essas variáveis são opcionais. Sem elas, os eventos continuam disponíveis nos logs da Function. Com elas, o endpoint encaminha os eventos para uma API externa compatível com JSON.

## Como ver os logs

Em produção, abra os logs do projeto no Cloudflare Pages ou execute um tail pelo Wrangler quando estiver autenticado:

```sh
npx wrangler pages deployment tail --project-name ifinanca
```

Procure por linhas contendo:

```txt
ifinanca.telemetry
```

## Teste local

Para validar o build e os testes unitários:

```sh
npm run test:unit -- --run
npm run build
```

Para testar a Function localmente:

```sh
npm run cloudflare:dev
```

Depois acesse a aplicação e, em outra janela, envie um evento manual:

```sh
curl -X POST http://127.0.0.1:8788/api/telemetry \
  -H "content-type: application/json" \
  -d "{\"events\":[{\"name\":\"manual.test\",\"properties\":{\"screen\":\"local\"}}]}"
```

## Guia para novos eventos

Ao adicionar um novo evento:

1. Use nome curto no formato `area.acao`, por exemplo `pluggy.data_loaded`.
2. Envie contagens, flags e estados, não dados sensíveis.
3. Use `severity: 'error'` apenas quando exigir investigação.
4. Prefira registrar o começo e o resultado de integrações externas.
5. Rode `npm run test:unit -- --run` e `npm run build`.
