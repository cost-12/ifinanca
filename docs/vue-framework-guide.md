# Vue.js no iFinanca

Este guia explica como o Vue 3 aparece neste projeto. A ideia e ajudar quem ainda nao conhece bem o framework a ler o codigo com mais seguranca.

## O papel do Vue

Vue e o framework usado para montar a interface do iFinanca. Ele organiza a aplicacao em componentes, atualiza a tela quando os dados mudam e conecta eventos do usuario com funcoes TypeScript.

No projeto, Vue cuida de:

- tela promocional publica
- login e cadastro
- dashboard financeiro
- mudanca de idioma
- mudanca de tema
- exibicao de mensagens de erro, carregamento e sucesso

## Arquivos principais

- `src/App.vue`: componente raiz; decide se mostra home, login ou dashboard.
- `src/components/MarketingHome.vue`: pagina inicial promocional.
- `src/components/AccessGate.vue`: login, cadastro, Google Auth e App Check.
- `src/components/FinanceDashboard.vue`: painel financeiro apos autenticacao.
- `src/i18n.ts`: textos traduzidos e formatacao de valores.
- `src/services`: camada de comunicacao com Firebase, Pluggy e Data Connect.

## Como ler um arquivo `.vue`

Um componente Vue costuma ter duas partes principais:

```vue
<script setup lang="ts">
// logica, estado, funcoes e imports
</script>

<template>
  <!-- HTML dinamico que usa a logica do script -->
</template>
```

O `script setup` e uma forma moderna e direta de escrever componentes Vue 3 com Composition API.

## Reatividade

Reatividade e o mecanismo que faz a tela atualizar quando um dado muda.

### `ref`

Use `ref` para valores simples que mudam:

```ts
const isSubmitting = ref(false)
```

No script, o valor real fica em `.value`. No template, o Vue acessa automaticamente:

```vue
<button :disabled="isSubmitting">Entrar</button>
```

### `reactive`

Use `reactive` para objetos com varios campos:

```ts
const form = reactive({
  email: '',
  password: '',
})
```

No `AccessGate.vue`, o formulario de login/cadastro usa `reactive` porque possui nome, e-mail, senha, objetivo e renda mensal.

### `computed`

Use `computed` para valores derivados de outros dados:

```ts
const isRegisterMode = computed(() => authMode.value === 'register')
```

No projeto, isso evita duplicar estado. Por exemplo, o dashboard calcula saldo total, entradas, saidas e notificacoes a partir das listas atuais.

### `watch`

Use `watch` quando uma mudanca precisa disparar um efeito:

```ts
watch(language, (nextLanguage) => {
  document.documentElement.lang = languageLocales[nextLanguage]
})
```

No `App.vue`, o `watch` de idioma atualiza o atributo `lang` do documento.

## Props e eventos

Componentes recebem dados por `props` e avisam o componente pai por eventos.

Exemplo simplificado:

```ts
const props = defineProps<{ language: AppLanguage }>()
const emit = defineEmits<{ authenticated: [profile: UserProfile] }>()
```

No iFinanca:

- `App.vue` passa `language`, `theme` e `profile` para componentes filhos.
- `AccessGate.vue` emite `authenticated` quando o usuario entra.
- `FinanceDashboard.vue` emite `profileUpdated`, `themeChange`, `languageChange` e `logout`.

Esse fluxo evita que cada componente controle tudo sozinho.

## Diretivas usadas no template

### `v-if` e `v-else`

Mostram ou escondem partes da tela:

```vue
<FinanceDashboard v-if="profile" />
<AccessGate v-else />
```

### `v-for`

Renderiza listas:

```vue
<option v-for="option in languageOptions" :key="option.value">
  {{ option.label }}
</option>
```

### `v-model`

Liga campos de formulario ao estado:

```vue
<input v-model="form.email" />
```

Quando o usuario digita, `form.email` muda automaticamente.

### `:class`, `:disabled` e outros bindings

O sinal `:` liga atributos a expressoes JavaScript:

```vue
<button :disabled="!canSubmit">
```

### `@click` e eventos

O sinal `@` escuta eventos:

```vue
<button @click="setAuthMode('login')">
```

## Fluxo das telas

### 1. App inicializa

`App.vue` observa o Firebase Auth com `observeAuthState`.

- Se nao houver usuario, mostra a home ou login.
- Se houver usuario com e-mail verificado, carrega o perfil.
- Se o e-mail nao estiver verificado, limpa o perfil e volta para acesso.

### 2. Home publica

`MarketingHome.vue` apresenta o produto e direciona para:

- `#login`
- `#cadastro`
- secoes informativas da propria pagina

O projeto usa hash simples em vez de Vue Router porque o fluxo publico ainda e pequeno.

### 3. Login e cadastro

`AccessGate.vue` valida e-mail, senha, confirmacao de senha e nome. Tambem aquece o App Check quando a chave esta configurada.

No login Google, o componente tenta garantir que o App Check esteja pronto antes de abrir o popup do Firebase.

### 4. Dashboard

`FinanceDashboard.vue` exibe dados mockados por padrao. Se houver Data Connect ou Pluggy configurado, ele substitui os dados demonstrativos por dados remotos.

## Servicos fora dos componentes

O projeto separa regras externas em `src/services`.

- `firebase.ts`: autenticacao, Firestore, App Check e mensagens de erro.
- `pluggy.ts`: abertura do Pluggy Connect e carregamento de dados bancarios.
- `dataconnect.ts`: chamadas GraphQL opcionais.

Essa separacao deixa os componentes mais focados na interface.

## Estilos

O visual usa Tailwind CSS e daisyUI.

Exemplo:

```vue
<button class="btn bg-[#17c964] text-[#06130a]">
```

- `btn` vem do daisyUI.
- `bg-[#17c964]` e `text-[#06130a]` vem do Tailwind.
- Classes responsivas como `sm:`, `md:` e `xl:` mudam o layout por tamanho de tela.

## Internacionalizacao

Os textos ficam em `src/i18n.ts`. Os componentes chamam:

```ts
translate(props.language, 'auth.loginTitle')
```

Isso permite trocar entre portugues, ingles e espanhol sem duplicar componentes.

## Caminho de estudo recomendado

1. Leia `src/App.vue` para entender o fluxo geral.
2. Leia `src/components/AccessGate.vue` para ver formulario, `ref`, `reactive`, `computed` e eventos.
3. Leia `src/components/FinanceDashboard.vue` para ver listas, filtros, dados derivados e integracoes.
4. Leia `src/services/firebase.ts` para entender como a interface conversa com Firebase.
5. Compare o template com o script para ver como cada variavel aparece na tela.

## Glossario rapido

- Componente: bloco reutilizavel de interface.
- Prop: dado recebido do componente pai.
- Emit: evento enviado para o componente pai.
- Estado: dado que pode mudar e alterar a tela.
- Reatividade: atualizacao automatica da tela quando o estado muda.
- Template: parte visual do componente.
- Service: arquivo que concentra integracao externa ou regra compartilhada.
