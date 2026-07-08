# IndexedDB no iFinanca

O iFinanca usa IndexedDB para guardar dados estruturados importantes no navegador sem bloquear a interface.

Segundo a MDN, IndexedDB é indicada para armazenamento client-side de quantidades significativas de informações e permite buscas de dados estruturados com boa performance. A API usada pelo projeto é assíncrona, evitando travar a thread principal durante leitura e escrita.

Referência: https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API

## Onde é usado

### Snapshot do dashboard

Store: `dashboardSnapshots`

Guarda o último estado financeiro útil por usuário:

- origem dos dados (`pluggy`, `dataconnect` ou `mock`)
- contas exibidas
- transações exibidas
- último `itemId` Pluggy usado na sessão
- horário do cache
- avisos parciais de sincronização Pluggy

Esse snapshot permite restaurar a tela quando Pluggy/Data Connect falham ou demoram, mantendo uma experiência mais estável.

### Fila de telemetria

Store: `telemetryQueue`

Quando a telemetria não consegue ser enviada para `/api/telemetry`, os eventos sanitizados ficam em fila local e são reenviados quando o navegador volta a ficar online.

## O que não deve ser salvo

Não salve no IndexedDB:

- senha
- token Firebase
- token Pluggy
- API keys
- documentos pessoais
- credenciais sensíveis
- respostas completas de APIs bancárias com dados que não são usados na interface

## Arquivo principal

A camada de acesso fica em:

```txt
src/services/indexeddb.ts
```

Ela usa a API nativa do navegador e retorna silenciosamente quando IndexedDB não está disponível, como em alguns ambientes de teste ou navegação restritiva.

## Como testar

```sh
npm run test:unit -- --run
npm run build
```

No navegador, abra DevTools:

```txt
Application > Storage > IndexedDB > ifinanca-client-cache
```

Stores esperadas:

- `dashboardSnapshots`
- `telemetryQueue`
