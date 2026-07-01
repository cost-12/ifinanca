# Pluggy + Firebase

Este projeto deixa o front pronto para abrir o Pluggy Connect Widget. A parte sensivel fica em backend, porque `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nao podem ir para o navegador.

## Fluxo oficial

1. O usuario cria o cadastro no iFinanca.
2. O dashboard chama `VITE_PLUGGY_CONNECT_TOKEN_URL`.
3. A Firebase Function chama `POST https://api.pluggy.ai/auth`.
4. A Pluggy valida `clientId` e `clientSecret` e retorna `apiKey`.
5. A Function chama `POST https://api.pluggy.ai/connect_token` com header `X-API-KEY`.
6. A Pluggy retorna `accessToken`.
7. A Function normaliza a resposta para `{ "connectToken": "..." }`.
8. O front usa esse token no `pluggy-connect-sdk`.

Referencias:

- Create API Key: https://docs.pluggy.ai/reference/auth-create
- Create Connect Token: https://docs.pluggy.ai/reference/connect-token-create

## Contrato esperado pelo front

Request:

```http
POST /createPluggyConnectToken
Content-Type: application/json
```

```json
{
  "clientUserId": "profile-id",
  "userEmail": "usuario@email.com",
  "options": {
    "clientUserId": "profile-id",
    "avoidDuplicates": true
  }
}
```

Response:

```json
{
  "connectToken": "pluggy-connect-token",
  "accessToken": "pluggy-connect-token",
  "expiresAt": null
}
```

O front aceita `connectToken`, `accessToken` ou `token`, mas a Function do projeto retorna `connectToken` para manter o contrato claro.

## Options suportadas

A Function repassa para `/connect_token` apenas as opcoes suportadas pela documentacao da Pluggy:

- `clientUserId`: identificador interno do usuario para rastreabilidade.
- `webhookUrl`: webhook especifico para eventos do item criado.
- `oauthRedirectUri`: URL de retorno apos fluxo OAuth.
- `avoidDuplicates`: evita criar um novo item se ja existir outro com as mesmas credenciais.

Para atualizar uma conexao existente, envie `itemId` no corpo da chamada. A propria Pluggy exige esse campo no modo update.

## Function incluida no projeto

Este repositorio ja inclui `functions/index.js` com o endpoint `createPluggyConnectToken`.

Configure os secrets antes do deploy:

```sh
firebase functions:secrets:set PLUGGY_CLIENT_ID
firebase functions:secrets:set PLUGGY_CLIENT_SECRET
firebase deploy --only functions
```

A URL esperada no `.env.local` e:

```sh
VITE_PLUGGY_CONNECT_TOKEN_URL=https://southamerica-east1-pluggy-firebase.cloudfunctions.net/createPluggyConnectToken
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
  --data "{\"options\":{\"clientUserId\":\"profile-id\",\"avoidDuplicates\":true}}"
```

Resposta oficial da Pluggy:

```json
{
  "accessToken": "pluggy-connect-token"
}
```
