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

O projeto ja esta apontado para o Firebase `pluggy-firebase` via `.firebaserc`. O `.env.local` local foi gerado com o app Web `iFinanca`; mantenha esse arquivo fora do git.

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

## Firebase

Arquivos configurados:

- `firebase.json`: Hosting, Firestore, Functions, Data Connect e emuladores.
- `firestore.rules`: permite apenas criacao validada em `ifinanca_leads` e bloqueia leitura/edicao pelo cliente.
- `functions/index.js`: endpoint `createPluggyConnectToken` para o Pluggy Connect.

O Firestore default foi criado no projeto `pluggy-firebase` e as regras foram publicadas. Para endurecer a seguranca em producao, ative Authentication/App Check e ajuste as regras para exigir `request.auth != null`. Para a Pluggy Function, configure os secrets:

```sh
firebase functions:secrets:set PLUGGY_CLIENT_ID
firebase functions:secrets:set PLUGGY_CLIENT_SECRET
```

Deploy:

```sh
npm run firebase:deploy:rules
npm run firebase:deploy:functions
npm run firebase:deploy:hosting
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
