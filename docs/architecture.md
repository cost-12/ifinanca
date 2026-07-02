# Arquitetura do iFinanca

## Visão geral

A aplicação foi organizada como uma SPA moderna com separação entre camada de apresentação, serviços e integrações externas. O fluxo principal é simples: o usuário entra na aplicação, autentica-se, o perfil é carregado e o dashboard mostra dados financeiros.

## Camadas

### 1. Interface

A camada de interface é implementada em Vue 3 com componentes reutilizáveis e estado local reativo. A experiência é pensada para funcionar tanto em desktop quanto em dispositivos móveis.

### 2. Serviços

Os serviços encapsulam integrações com Firebase, Pluggy e Data Connect. Eles ficam em src/services e são consumidos pelos componentes sem misturar lógica de rede com a UI.

### 3. Dados

Os dados estáticos e os modelos de domínio estão em src/data e src/types. Isso facilita a evolução da aplicação sem quebrar o restante do código.

### 4. Integrações externas

A aplicação pode se comunicar com:

- Firebase Authentication e Firestore
- Pluggy Connect via Cloudflare Pages Functions
- Firebase Data Connect quando configurado

## Fluxo de autenticação

1. App.vue observa o estado de autenticação.
2. Se não houver usuário, a tela de acesso é exibida.
3. Se houver usuário e e-mail verificado, o perfil é carregado do Firestore.
4. O perfil é persistido localmente e usado pelo dashboard.

## Fluxo do dashboard

1. O dashboard recebe o perfil e o idioma/tema do App.
2. Ele carrega transações mockadas por padrão.
3. Se houver endpoint de Data Connect configurado, tenta carregar transações do backend.
4. O usuário pode atualizar o status de transações quando a integração estiver disponível.

## Considerações de segurança

- segredos do Pluggy ficam no ambiente do Cloudflare Pages
- Firestore usa regras para limitar o acesso por usuário autenticado
- dados sensíveis não devem ser expostos no frontend

## Pontos de extensão

- adicionar novas telas e módulos
- trocar a fonte de dados de mock para backend real
- implementar cache e sincronização incremental
- ampliar a camada de testes e observabilidade
