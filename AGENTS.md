# iFinanca: contexto para desenvolvedores e agentes de IA

## Objetivo do projeto

iFinanca é uma aplicação Vue 3 para gestão financeira pessoal. Ela possui home promocional, login/cadastro, dashboard financeiro, integração com Firebase, Cloudflare Pages Functions, Pluggy Connect e uma camada opcional de Firebase Data Connect.

## Arquitetura rápida

- `src/App.vue`: orquestra autenticação, tema, idioma e rotas públicas limpas.
- `src/components/MarketingHome.vue`: página inicial promocional.
- `src/components/AccessGate.vue`: login, cadastro, Google e App Check.
- `src/components/FinanceDashboard.vue`: dashboard, Pluggy, Data Connect, perfil e abas.
- `src/services/firebase.ts`: Firebase Auth, Firestore e App Check.
- `src/services/pluggy.ts`: widget Pluggy e leitura de dados bancários.
- `src/services/dataconnect.ts`: integração opcional com Data Connect.
- `src/services/telemetry.ts`: eventos de diagnóstico do frontend.
- `functions/api`: endpoints serverless do Cloudflare Pages.
- `docs`: documentação técnica e material de apoio.

## Rotas

O projeto usa rotas limpas de SPA:

- `/`: home promocional.
- `/login`: acesso com conta existente.
- `/cadastro`: criação de conta.

O arquivo `public/_redirects` mantém fallback para `index.html` no Cloudflare Pages.

## Comandos essenciais

```sh
npm install
npm run dev
npm run test:unit -- --run
npm run build
npm run cloudflare:dev
```

Use Node 24.15.0 ou superior compatível.

## Variáveis importantes

Frontend:

```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_PLUGGY_CONNECT_TOKEN_URL=/api/connect-token
VITE_PLUGGY_INCLUDE_SANDBOX=true
VITE_TELEMETRY_ENABLED=
VITE_TELEMETRY_DEBUG=false
VITE_TELEMETRY_ENDPOINT=/api/telemetry
```

Cloudflare Pages Functions:

```sh
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_WEBHOOK_SECRET=
FIREBASE_WEB_API_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_ENTERPRISE_PROJECT_ID=
RECAPTCHA_ENTERPRISE_API_KEY=
TELEMETRY_INGEST_URL=
TELEMETRY_INGEST_TOKEN=
```

## O que testar depois de mudanças

- Login e cadastro com e-mail/senha.
- Login com Google quando App Check estiver configurado.
- Rota `/login` e `/cadastro` sem `#`.
- Responsividade em mobile e desktop.
- Conexão Pluggy em sandbox quando `VITE_PLUGGY_INCLUDE_SANDBOX=true`.
- Ocultar/exibir saldo no dashboard.
- Logs de telemetria em `/api/telemetry`.

## Boas práticas para agentes

- Não exponha segredos no frontend.
- Não registre e-mail, senha, token, documento ou dados bancários completos em telemetria.
- Prefira alterações pequenas e verificáveis.
- Rode `npm run test:unit -- --run` e `npm run build` antes de concluir.
- Leia `docs/telemetry-diagnostics.md`, `docs/pluggy-firebase.md` e `docs/auth-appcheck.md` antes de mexer em integrações.
