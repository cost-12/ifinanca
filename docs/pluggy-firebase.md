# Pluggy + Firebase

Este projeto deixa o front pronto para abrir o Pluggy Connect Widget. A parte sensivel precisa ficar em backend, porque `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nao podem ir para o navegador.

## Fluxo

1. O usuario cria o cadastro no iFinanca.
2. O dashboard chama `VITE_PLUGGY_CONNECT_TOKEN_URL`.
3. Uma Firebase Function usa credenciais Pluggy em ambiente seguro.
4. A Function retorna `{ "connectToken": "..." }`.
5. O front abre o widget via `pluggy-connect-sdk`.
6. O `item.id` retornado pode ser salvo no Firestore e sincronizado por webhook.

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
  "connectToken": "pluggy-connect-token"
}
```

## Exemplo de Function

```ts
import { onRequest } from 'firebase-functions/v2/https'
import { PluggyClient } from 'pluggy-sdk'

export const createPluggyConnectToken = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const client = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  })

  const token = await client.createConnectToken({
    options: {
      clientUserId: request.body.clientUserId,
      avoidDuplicates: true,
    },
  })

  response.json({ connectToken: token.accessToken ?? token.connectToken ?? token })
})
```

O formato exato do retorno pode variar conforme a versao do SDK. O front aceita `connectToken` ou `token`.
