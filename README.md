# iFinanca

Plataforma Vue para gestao financeira pessoal com visual inspirado no Meu Pluggy, usando Vite, Tailwind CSS, daisyUI, Cloudflare Pages, Firebase Firestore e Pluggy Connect.

## Arquitetura

- Frontend: Vue/Vite hospedado no Cloudflare Pages.
- Autenticacao: Firebase Authentication com provedor Email/Senha.
- Banco de dados: Firebase Firestore para perfis protegidos em `users/{uid}`.
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

Para deploy via Cloudflare Pages conectado ao Git, configure essas variaveis como build variables no painel do Pages. Nao versione `.env.production` com valores reais.

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

Habilite o provedor Email/Senha em `Authentication > Sign-in method` no console Firebase. O cadastro envia um link de verificacao por e-mail e o dashboard so abre quando `emailVerified` estiver verdadeiro.

O Firestore salva perfis em `users/{uid}`. As regras exigem `request.auth.uid == userId`, validam campos permitidos, bloqueiam `ifinanca_leads` e negam qualquer outra colecao por padrao.

Para publicar as regras:

```sh
npm run firebase:deploy:rules
```

Para endurecer ainda mais a producao, ative App Check no app Web Firebase e configure enforcement para Firestore.

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
