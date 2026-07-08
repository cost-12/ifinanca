# Documentação do projeto iFinanca

## Visão geral

iFinanca é uma aplicação web de gestão financeira pessoal construída com Vue 3, TypeScript, Vite, Firebase e Pluggy Connect. O objetivo do projeto é oferecer uma experiência simples para acompanhar fluxo de caixa, contas, conexões bancárias e metas financeiras.

## Recursos principais

- autenticação com Firebase
- cadastro e recuperação de conta
- perfil do usuário com objetivo financeiro e renda mensal
- dashboard financeiro com visão geral, fluxo, ativos e conexões
- integração com Pluggy Connect para conectar contas bancárias
- suporte a internacionalização em português, inglês e espanhol
- integração opcional com Firebase Data Connect para sincronizar usuários e transações
- tema claro/escuro e experiência responsiva
- guia didático de Vue.js para iniciantes no projeto

## Arquitetura

### Frontend

- Vue 3 + TypeScript
- Vite como build tool
- Tailwind CSS + daisyUI para interface
- Componentes principais:
  - App.vue: orquestra autenticação, tema e idioma
  - AccessGate.vue: tela de acesso, login e cadastro
  - FinanceDashboard.vue: painel principal com dados e ações

### Backend e serviços

- Firebase Authentication para autenticação
- Firestore para armazenamento de perfis de usuário
- Cloudflare Pages Functions para emissão de token Pluggy e leitura de contas/transações
- Firebase Data Connect como camada opcional de sincronização

### Estrutura de pastas

- src/components: componentes Vue
- src/services: integrações com Firebase, Pluggy e Data Connect
- src/types: modelos de tipos compartilhados
- src/data: dados estáticos usados pelo dashboard
- src/i18n.ts: mensagens e helpers de tradução
- functions/api: funções serverless para Cloudflare Pages
- dataconnect: schema e operações GraphQL de exemplo
- docs: documentação adicional

## Fluxo de uso

1. O usuário acessa a aplicação e realiza cadastro ou login.
2. O perfil é salvo no Firestore com dados básicos e o objetivo financeiro.
3. O dashboard exibe uma visão inicial com saldo, fluxo e ativos.
4. O usuário pode conectar contas bancárias via Pluggy Connect.
5. Quando configurado, o projeto também pode sincronizar dados com Firebase Data Connect.

## Configuração local

### Pré-requisitos

- Node.js 24.15+ ou versão compatível
- npm

### Passos

```sh
npm install
cp .env.example .env.local
npm run dev
```

### Variáveis de ambiente

As principais variáveis esperadas são:

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
VITE_FIREBASE_DATACONNECT_ENDPOINT=
```

## Scripts disponíveis

```sh
npm run dev
npm run build
npm run type-check
npm run test:unit
npm run test:e2e
npm run cloudflare:dev
npm run cloudflare:deploy
```

## Integrações

### Firebase

- autenticação por e-mail e Google
- armazenamento de perfis em Firestore
- regras de segurança definidas em firestore.rules
- App Check com reCAPTCHA Enterprise para fortalecer o fluxo de login do Google
- a chave de site do reCAPTCHA é usada no frontend via VITE_FIREBASE_APPCHECK_SITE_KEY; a chave secreta deve ficar em uma variável secreta do servidor, como no Cloudflare Pages
- veja [auth-appcheck.md](auth-appcheck.md) para domínios autorizados, App Check e troubleshooting
- veja [vue-framework-guide.md](vue-framework-guide.md) para entender como Vue 3 funciona neste projeto

### Pluggy Connect

- fluxo de conexão de contas bancárias
- funcionamento via função serverless em functions/api/connect-token.ts
- carregamento de contas e transações via functions/api/pluggy-data.ts
- suporte a conectores Sandbox quando VITE_PLUGGY_INCLUDE_SANDBOX=true

### Data Connect

- integração opcional para sincronizar usuários e transações
- schema e queries/mutations em dataconnect/

## Boas práticas

- manter segredos fora do repositório
- usar variáveis de ambiente para credenciais e endpoints
- validar dados antes de persistir no backend
- manter a UI funcional mesmo quando integrações externas não estiverem configuradas

## Próximos passos recomendados

- conectar a aplicação a um endpoint real de Data Connect
- expandir o modelo de transações com categorias e bancos reais
- adicionar testes end-to-end mais completos para fluxos principais
- implementar monitoramento e logs de integrações externas
