# iFinanca

Plataforma Vue para gestao financeira pessoal com visual inspirado no Meu Pluggy, usando Vite, Tailwind CSS, daisyUI, Firebase e Pluggy Connect.

## O que ja existe

- Tela inicial de acesso/divulgacao com cadastro antes da area principal.
- Dashboard financeiro responsivo com overview, fluxo, ativos e conexoes.
- Integracao Firebase preparada para salvar leads em `ifinanca_leads`.
- Integracao Pluggy Connect preparada via `VITE_PLUGGY_CONNECT_TOKEN_URL`.
- Fallback local/demo quando Firebase ou Pluggy ainda nao estiverem configurados.

## Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com as chaves do Firebase Web SDK e com o endpoint seguro que cria o `connectToken` da Pluggy.

## Variaveis

```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_PLUGGY_CONNECT_TOKEN_URL=
VITE_PLUGGY_INCLUDE_SANDBOX=true
```

## Pluggy

O front nunca deve receber `PLUGGY_CLIENT_ID` nem `PLUGGY_CLIENT_SECRET`. Configure uma Firebase Function ou outro backend para gerar o `connectToken` e retorne:

```json
{
  "connectToken": "token-gerado-pela-pluggy"
}
```

Veja [docs/pluggy-firebase.md](docs/pluggy-firebase.md) para o fluxo recomendado.

## Scripts

```sh
npm run dev
npm run build
npm run test:unit
npm run test:e2e
```
