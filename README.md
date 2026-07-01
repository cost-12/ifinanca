# iFinanca

Plataforma Vue para gestao financeira pessoal com visual inspirado no Meu Pluggy, usando Vite, Tailwind CSS, daisyUI, Cloudflare Pages, Firebase Firestore e Pluggy Connect.

## Arquitetura

- Frontend: Vue/Vite hospedado no Cloudflare Pages.
- Banco de dados: Firebase Firestore para salvar leads em `ifinanca_leads`.
- Pluggy: Cloudflare Pages Function em `/api/connect-token`, mantendo credenciais server-side.
- SPA fallback: `public/_redirects` redireciona rotas para `index.html`.

## Setup local

```sh
npm install
cp .env.example .env.local
npm run dev
```

Use Node 22.18.0 ou superior compativel. O arquivo `.nvmrc` fixa 22.18.0 para o build remoto do Cloudflare Pages.

O `.env.local` local ja esta apontado para o app Web Firebase `iFinanca` do projeto `pluggy-firebase`. Mantenha esse arquivo fora do git.

## Variaveis do frontend

```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_PLUGGY_CONNECT_TOKEN_URL=/api/connect-token
VITE_PLUGGY_INCLUDE_SANDBOX=true
```

Para deploy via Cloudflare Pages conectado ao Git, configure essas variaveis como build variables no painel do Pages. Para deploy via CLI local, `.env.production` ja fornece os valores publicos necessarios.

## Deploy automatico via GitHub

No projeto `ifinanca` em Cloudflare Pages, use:

```txt
Framework preset: Vue ou Vite
Root directory: /
Build command: npm run build
Build output directory: dist
Production branch: main
```

Em `Settings > Environment variables`, adicione tambem:

```txt
NODE_VERSION=22.18.0
```

O erro `Output directory "dist" not found` acontece quando o Pages tenta publicar `dist` sem antes executar o build. O `wrangler.toml` informa a pasta de saida (`pages_build_output_dir = "dist"`), mas o build automatico pelo Git ainda precisa do campo `Build command` configurado no painel.

## Secrets da Pluggy

Nunca exponha `PLUGGY_CLIENT_ID` ou `PLUGGY_CLIENT_SECRET` no navegador. Configure-os como secrets do Cloudflare Pages:

```sh
npx wrangler pages secret put PLUGGY_CLIENT_ID --project-name ifinanca
npx wrangler pages secret put PLUGGY_CLIENT_SECRET --project-name ifinanca
npx wrangler pages secret put PLUGGY_WEBHOOK_SECRET --project-name ifinanca
```

Para desenvolvimento local com `npm run cloudflare:dev`, copie `.dev.vars.example` para `.dev.vars` e substitua pelos seus acessos reais da Pluggy.

## Firebase

O Firestore default do projeto `pluggy-firebase` foi criado e as regras foram publicadas. As regras permitem apenas criacao validada em `ifinanca_leads` e bloqueiam leitura/edicao pelo cliente.

Para endurecer a seguranca em producao, ative Authentication/App Check e ajuste as regras para exigir `request.auth != null`.

## Deploy

```sh
npm run cloudflare:deploy
```

Esse comando executa `npm run build` e publica `dist` no Cloudflare Pages.

## Scripts

```sh
npm run dev
npm run cloudflare:dev
npm run cloudflare:deploy
npm run build
npm run test:unit
npm run test:e2e
```

Veja [docs/pluggy-firebase.md](docs/pluggy-firebase.md) para o fluxo Pluggy + Cloudflare + Firebase.
