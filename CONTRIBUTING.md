# Como contribuir

Obrigado por contribuir com o iFinanca. Este guia resume o fluxo recomendado para propor melhorias, corrigir bugs e manter o projeto facil de entender.

## Ambiente local

```sh
npm install
cp .env.example .env.local
npm run dev
```

Use Node.js compativel com o campo `engines` do `package.json`. Em caso de duvida, consulte o arquivo `.nvmrc`.

## Antes de alterar codigo

- Leia o [README.md](README.md) e a documentacao em [docs/README.md](docs/README.md).
- Verifique se a mudanca afeta Firebase, Pluggy, Cloudflare Pages ou Data Connect.
- Nunca versione `.env.local`, `.dev.vars` ou credenciais reais.

## Padroes do projeto

- Componentes Vue ficam em `src/components`.
- Integracoes externas ficam em `src/services`.
- Tipos compartilhados ficam em `src/types`.
- Dados demonstrativos ficam em `src/data`.
- Documentacao tecnica fica em `docs`.

## Estilo de codigo

- Prefira Vue 3 com Composition API e `<script setup>`.
- Use TypeScript de forma explicita quando o dado atravessa componentes ou servicos.
- Mantenha comentarios curtos e apenas onde a regra de negocio nao for obvia.
- Preserve a responsividade em mobile, tablet e desktop.
- Mantenha segredos no servidor ou em variaveis de ambiente.

## Testes e validacao

Antes de abrir um pull request, rode:

```sh
npm run build
npm run test:unit -- --run
```

Quando alterar fluxo visual, login, dashboard ou responsividade, rode tambem:

```sh
npm run test:e2e
```

## Fluxo sugerido

1. Crie uma branch com nome descritivo, por exemplo `feature/guia-vue` ou `fix/login-app-check`.
2. Faca commits pequenos e com mensagem clara.
3. Atualize documentos quando a mudanca alterar comportamento, configuracao ou arquitetura.
4. Abra um pull request usando o template do repositorio.

## Checklist rapido

- A aplicacao compila.
- Os testes unitarios passam.
- A mudanca foi testada em tela pequena.
- Nao ha credenciais ou dados sensiveis no diff.
- A documentacao foi atualizada quando necessario.
