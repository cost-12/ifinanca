# Pluggy + Cloudflare Pages + Firebase

Este projeto usa Cloudflare Pages para hospedar o app Vue e Firebase Firestore como banco de dados. A parte sensivel da Pluggy fica em uma Cloudflare Pages Function, porque `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nao podem ir para o navegador.

## Fluxo oficial

1. O usuario cria conta ou entra com Firebase Authentication Email/Senha.
2. O perfil autenticado e gravado/lido no Firestore em `users/{uid}`.
3. O dashboard chama `VITE_PLUGGY_CONNECT_TOKEN_URL`, hoje `/api/connect-token`.
4. A Pages Function usa `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` server-side.
5. A Function chama `POST https://api.pluggy.ai/auth`.
6. A Pluggy valida `clientId` e `clientSecret` e retorna `apiKey`.
7. A Function chama `POST https://api.pluggy.ai/connect_token` com header `X-API-KEY`.
8. A Pluggy retorna `accessToken`.
9. A Function normaliza a resposta para `{ "connectToken": "...", "accessToken": "..." }`.
10. O front usa esse token no `pluggy-connect-sdk`.

Referencias:

- Create API Key: https://docs.pluggy.ai/reference/auth-create
- Create Connect Token: https://docs.pluggy.ai/reference/connect-token-create
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/

## Endpoint

Arquivo:

```text
functions/api/connect-token.ts
```

Rota publicada:

```http
POST /api/connect-token
Content-Type: application/json
```

Request:

```json
{
  "clientUserId": "firebase-auth-uid",
  "userEmail": "usuario@email.com",
  "options": {
    "clientUserId": "firebase-auth-uid",
    "avoidDuplicates": true
  }
}
```

Response:

```json
{
  "connectToken": "pluggy-connect-token",
  "accessToken": "pluggy-connect-token"
}
```

O front aceita `connectToken`, `accessToken` ou `token`.

## Webhook Pluggy

Arquivo:

```text
functions/api/webhooks/pluggy.ts
```

Rota publicada:

```http
POST /api/webhooks/pluggy
Content-Type: application/json
```

Payload esperado, conforme a documentacao da Pluggy:

```json
{
  "event": "item/created",
  "eventId": "d876fd7c-e9bd-4c4c-bd46-cc96c62aac29",
  "itemId": "a5c763cb-0952-457b-9936-630f79c5b016",
  "triggeredBy": "USER",
  "clientUserId": "firebase-auth-uid"
}
```

A Function responde rapidamente:

```json
{
  "received": true,
  "event": "item/created",
  "eventId": "d876fd7c-e9bd-4c4c-bd46-cc96c62aac29"
}
```

Eventos tratados:

- `item/created`
- `item/updated`
- `item/error`

Outros eventos sao aceitos e registrados nos logs do Cloudflare.

### Protecao do webhook

Configure um secret aleatorio no Cloudflare:

```sh
npx wrangler pages secret put PLUGGY_WEBHOOK_SECRET --project-name ifinanca
```

Ao criar o webhook na Pluggy, envie esse mesmo valor em um header customizado:

```json
{
  "event": "all",
  "url": "https://ifinanca.pages.dev/api/webhooks/pluggy",
  "headers": {
    "x-ifinanca-webhook-secret": "seu_secret_aleatorio"
  }
}
```

Se preferir usar webhook por Connect Token, configure `PLUGGY_WEBHOOK_URL` como secret/var server-side. Nesse caso, use uma URL com token:

```sh
PLUGGY_WEBHOOK_URL=https://ifinanca.pages.dev/api/webhooks/pluggy?token=seu_secret_aleatorio
```

## Options suportadas

A Function repassa para `/connect_token` apenas as opcoes suportadas pela documentacao da Pluggy:

- `clientUserId`: identificador interno do usuario para rastreabilidade.
- `webhookUrl`: webhook especifico para eventos do item criado.
- `oauthRedirectUri`: URL de retorno apos fluxo OAuth.
- `avoidDuplicates`: evita criar um novo item se ja existir outro com as mesmas credenciais.
- `connectorSortAlphabetically`: ordena conectores alfabeticamente quando `true`.

Tambem e possivel configurar defaults server-side via secrets/vars:

- `PLUGGY_WEBHOOK_URL`
- `PLUGGY_OAUTH_REDIRECT_URI`

Para atualizar uma conexao existente, envie `itemId` no corpo da chamada. A propria Pluggy exige esse campo no modo update.

## Secrets da Pluggy

Substitua os valores por seus acessos reais da Pluggy no ambiente do servidor. Nao cole `clientId` nem `clientSecret` no codigo, no `.env.local` do Vite ou em qualquer arquivo que va para o navegador.

```sh
npx wrangler pages secret put PLUGGY_CLIENT_ID --project-name ifinanca
npx wrangler pages secret put PLUGGY_CLIENT_SECRET --project-name ifinanca
npx wrangler pages secret put PLUGGY_WEBHOOK_SECRET --project-name ifinanca
```

Para rodar localmente com Pages Functions:

```sh
cp .dev.vars.example .dev.vars
```

Depois edite `.dev.vars`:

```sh
PLUGGY_CLIENT_ID=seu_client_id_real
PLUGGY_CLIENT_SECRET=seu_client_secret_real
PLUGGY_WEBHOOK_SECRET=um_secret_aleatorio
```

## Variavel do frontend

Em Cloudflare Pages, o endpoint deve ser same-origin:

```sh
VITE_PLUGGY_CONNECT_TOKEN_URL=/api/connect-token
```

## Firebase Auth e regras

Habilite Email/Senha no Firebase Authentication. O app so exibe o dashboard apos `onAuthStateChanged` confirmar uma sessao ativa.

As regras em `firestore.rules`:

- permitem leitura/criacao/edicao apenas em `users/{uid}` do proprio usuario;
- validam campos do perfil, objetivo, renda mensal e tamanho do avatar;
- bloqueiam deletes de perfil;
- bloqueiam a antiga colecao anonima `ifinanca_leads`;
- negam todo o restante por padrao.

Publique com:

```sh
npm run firebase:deploy:rules
```

## cURL de referencia

Gerar API key:

```sh
curl --request POST \
  --url https://api.pluggy.ai/auth \
  --header "content-type: application/json" \
  --data "{\"clientId\":\"$PLUGGY_CLIENT_ID\",\"clientSecret\":\"$PLUGGY_CLIENT_SECRET\"}"
```

Gerar connect token:

```sh
curl --request POST \
  --url https://api.pluggy.ai/connect_token \
  --header "X-API-KEY: $PLUGGY_API_KEY" \
  --header "content-type: application/json" \
  --data "{\"options\":{\"clientUserId\":\"firebase-auth-uid\",\"avoidDuplicates\":true}}"
```

Resposta oficial da Pluggy:

```json
{
  "accessToken": "pluggy-connect-token"
}
```

Criar webhook global:

```sh
curl --request POST \
  --url https://api.pluggy.ai/webhooks \
  --header "X-API-KEY: $PLUGGY_API_KEY" \
  --header "content-type: application/json" \
  --data "{\"event\":\"all\",\"url\":\"https://ifinanca.pages.dev/api/webhooks/pluggy\",\"headers\":{\"x-ifinanca-webhook-secret\":\"$PLUGGY_WEBHOOK_SECRET\"}}"
```
