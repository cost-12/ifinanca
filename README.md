# iFinanca

Plataforma Vue para gestao financeira pessoal com visual inspirado no Meu Pluggy, usando Vite, Tailwind CSS, daisyUI, Cloudflare Pages, Firebase Firestore e Pluggy Connect.

## Arquitetura

- Frontend: Vue/Vite hospedado no Cloudflare Pages.
- Autenticacao: Firebase Authentication com provedor Email/Senha.
- Banco de dados: Firebase Firestore para perfis protegidos em `users/{uid}`.
- Pluggy: Cloudflare Pages Functions em `/api/connect-token` e `/api/pluggy-data`, mantendo credenciais server-side.
- SPA fallback: `public/_redirects` redireciona rotas para `index.html`.
- Telemetria: `/api/telemetry` registra eventos sanitizados para diagnosticar autenticação, Pluggy, Data Connect e desempenho.
- IndexedDB: cache local de snapshots financeiros e fila offline de telemetria.

## Setup local

```sh
npm install
cp .env.example .env.local
npm run dev
```

Use Node 24.15.0 ou superior compativel. Os arquivos `.nvmrc` e `.node-version` fixam 24.15.0 para alinhar o ambiente local ao build remoto do Cloudflare Pages.

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
VITE_TELEMETRY_ENABLED=
VITE_TELEMETRY_DEBUG=false
VITE_TELEMETRY_ENDPOINT=/api/telemetry
```

`VITE_PLUGGY_CONNECT_TOKEN_URL` pode ficar omitida quando o app estiver usando o endpoint same-origin `/api/connect-token`. Use `VITE_PLUGGY_INCLUDE_SANDBOX=true` somente em desenvolvimento, preview ou apresentacao controlada.

Para deploy via Cloudflare Pages conectado ao Git, configure essas variaveis como build variables no painel do Pages. Nao versione `.env.production` com valores reais.

## Deploy automatico via GitHub

No projeto `ifinanca` em Cloudflare Pages, use:

```txt
Framework preset: Vue ou Vite
Root directory: /
Build command: npm run build
Deploy command: npm run deploy
Build output directory: dist
Production branch: main
```

Em `Settings > Environment variables`, adicione tambem:

```txt
NODE_VERSION=24.15.0
```

O Cloudflare Pages permite escolher a versao do Node via `NODE_VERSION`, `.nvmrc` ou `.node-version`. No build system v3, o campo `engines` do `package.json` nao e usado para detectar automaticamente a versao, entao mantenha `NODE_VERSION=24.15.0` configurado no painel.

Se a tela de build mostrar `Deploy command: npx wrangler deploy`, altere para `npm run deploy` ou `npx wrangler pages deploy dist --project-name ifinanca`. O comando `wrangler deploy` e para Workers e falha neste projeto com `Missing entry-point to Worker script or to assets directory`.

Se o deploy falhar com `Authentication error [code: 10000]` ao chamar `/pages/projects/ifinanca`, o build ja passou e o problema esta no token de deploy. Crie ou atualize o token usado em `CLOUDFLARE_API_TOKEN` com:

```txt
Permission: Account > Cloudflare Pages > Edit
Account Resources: Include > Thedelacosta@gmail.com's Account
CLOUDFLARE_ACCOUNT_ID=42f87161e9eae328eb49814a23fa0364
```

No painel de Builds, o campo `Build token` tambem precisa apontar para um token com essa permissao. Um token apenas de Worker ou sem `Cloudflare Pages: Edit` falha mesmo que o usuario seja Super Administrator.

O erro `Output directory "dist" not found` acontece quando o Pages tenta publicar `dist` sem antes executar o build. O `wrangler.toml` informa a pasta de saida (`pages_build_output_dir = "dist"`), mas o build automatico pelo Git ainda precisa do campo `Build command` configurado no painel.

## Secrets da Pluggy

Nunca exponha `PLUGGY_CLIENT_ID` ou `PLUGGY_CLIENT_SECRET` no navegador. Configure-os como secrets do Cloudflare Pages:

```sh
npx wrangler pages secret put PLUGGY_CLIENT_ID --project-name ifinanca
npx wrangler pages secret put PLUGGY_CLIENT_SECRET --project-name ifinanca
npx wrangler pages secret put PLUGGY_WEBHOOK_SECRET --project-name ifinanca
```

Para desenvolvimento local com `npm run cloudflare:dev`, copie `.dev.vars.example` para `.dev.vars` e substitua pelos seus acessos reais da Pluggy.

O endpoint `/api/pluggy-data` tambem usa esses secrets para buscar dados dinamicos da Pluggy. Se `FIREBASE_WEB_API_KEY` estiver definido no Cloudflare, o frontend precisa estar autenticado para enviar o Firebase ID token na chamada.

## Telemetria

O frontend envia eventos de diagnóstico para `/api/telemetry`. Em produção, o envio fica ativo por padrão, a menos que `VITE_TELEMETRY_ENABLED=false` seja configurado. Para depurar localmente, use `VITE_TELEMETRY_ENABLED=true` e `VITE_TELEMETRY_DEBUG=true`.

No Cloudflare Pages, os eventos aparecem nos logs da Function como `ifinanca.telemetry`. Opcionalmente, configure `TELEMETRY_INGEST_URL` e `TELEMETRY_INGEST_TOKEN` para encaminhar os eventos para uma API externa.

## Firebase

Habilite os provedores em `Authentication > Sign-in method` no console Firebase:

- Email/Senha: o cadastro envia um link de verificacao por e-mail e o dashboard so abre quando `emailVerified` estiver verdadeiro.
- Google: permite cadastro/login via popup e cria o perfil inicial em `users/{uid}` no primeiro acesso.

Em `Authentication > Settings > Authorized domains`, adicione `ifinanca.pages.dev`, `localhost` e qualquer dominio proprio usado em producao.

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
npm run deploy
npm run cloudflare:deploy
npm run build
npm run test:unit
npm run test:e2e
```

Veja [docs/pluggy-firebase.md](docs/pluggy-firebase.md) para o fluxo Pluggy + Cloudflare + Firebase.
Veja [docs/telemetry-diagnostics.md](docs/telemetry-diagnostics.md) para os eventos de diagnóstico.
Veja [docs/indexeddb-cache.md](docs/indexeddb-cache.md) para o cache local no navegador.

## Contribuicao e aprendizado

- Veja [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de contribuicao.
- Veja [docs/vue-framework-guide.md](docs/vue-framework-guide.md) para entender como Vue 3 funciona no projeto.
- Veja [AGENTS.md](AGENTS.md) para contexto rápido de manutenção por desenvolvedores e agentes de IA.
