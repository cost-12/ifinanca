# Firebase Auth, App Check e reCAPTCHA Enterprise

Este documento descreve a configuracao necessaria para autenticacao e protecao anti-abuso do iFinanca.

## Visao geral

O iFinanca usa **Firebase App Check** com **reCAPTCHA Enterprise invisivel** (`ReCaptchaEnterpriseProvider`). Esse fluxo e gerenciado pelo SDK Firebase em `src/services/firebase.ts`.

Nao carregue um widget manual de reCAPTCHA com a mesma site key. Isso duplicava o script `enterprise.js`, causava corrida entre inicializacoes e deixava a tela presa em "Carregando verificacao de seguranca...".

O login com Google depende apenas do App Check. Nao exige checkbox manual nem chamada a `/api/verify-recaptcha`.

## Variaveis no Cloudflare Pages

### Build variables (frontend)

```txt
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
```

`VITE_FIREBASE_APPCHECK_SITE_KEY` deve ser a **site key do reCAPTCHA Enterprise** registrada para os dominios abaixo.

Como toda variavel `VITE_*`, esse valor fica embutido no bundle gerado pelo `npm run build`. Ao alterar essa chave no Cloudflare Pages, faca um novo deploy para que o navegador receba o JavaScript atualizado.

### Secrets (servidor)

```txt
RECAPTCHA_SECRET_KEY=
RECAPTCHA_ENTERPRISE_PROJECT_ID=
RECAPTCHA_ENTERPRISE_API_KEY=
```

- `RECAPTCHA_SECRET_KEY`: usada apenas por `/api/verify-recaptcha` (endpoint legado/opcional).
- `RECAPTCHA_ENTERPRISE_PROJECT_ID` + `RECAPTCHA_ENTERPRISE_API_KEY`: habilitam validacao via Enterprise Assessments API quando necessario.

Configure secrets com:

```sh
npx wrangler pages secret put RECAPTCHA_SECRET_KEY --project-name ifinanca
npx wrangler pages secret put RECAPTCHA_ENTERPRISE_PROJECT_ID --project-name ifinanca
npx wrangler pages secret put RECAPTCHA_ENTERPRISE_API_KEY --project-name ifinanca
```

Nunca coloque essas chaves em variaveis `VITE_*`.

## Firebase Console

### Authentication

1. Habilite **Email/Senha** e **Google**.

2. Em **Settings > Authorized domains**, inclua:
   - `ifinanca.pages.dev`
   - `localhost`
   - qualquer dominio customizado de producao

3. Os e-mails de verificacao e redefinicao de senha usam URL de retorno para `/login`
   no dominio atual da aplicacao. Se o dominio nao estiver autorizado, o Firebase
   pode recusar o envio com `auth/unauthorized-continue-uri`.

### App Check

1. Registre o app Web no App Check.
2. Escolha **reCAPTCHA Enterprise** como provedor.
3. Use a mesma site key configurada em `VITE_FIREBASE_APPCHECK_SITE_KEY`.
4. Ative enforcement apenas depois de validar tokens em producao.

## Google Cloud / reCAPTCHA Enterprise

Na chave Enterprise usada pelo App Check:

1. Adicione os dominios autorizados:
   - `ifinanca.pages.dev`
   - `localhost`
   - previews do Cloudflare Pages, se usados (`*.pages.dev`)
2. Confirme que a chave e do tipo compativel com App Check (Enterprise invisivel).
3. Se o dominio nao bater, o App Check falha silenciosamente ou expira — o app agora mostra erro com retry apos timeout de 10s.

## Desenvolvimento local

Opcionalmente, use debug token apenas em dev:

```sh
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=seu-debug-token-do-firebase
```

Esse valor so e lido quando `import.meta.env.DEV === true`. Nunca configure debug token em producao.

Para Pages Functions locais:

```sh
cp .dev.vars.example .dev.vars
```

## Comportamento no frontend

1. `AccessGate.vue` chama `warmUpAppCheck()` no mount.
2. Enquanto o token nao chega, mostra "Carregando verificacao de seguranca...".
3. Se falhar apos timeout/retry, mostra erro claro e botao **Tentar novamente**.
4. "Continuar com Google" chama `ensureAppCheckReady()` e depois `signInWithPopup`.
5. Login/cadastro por e-mail e redefinicao de senha tambem conferem App Check
   quando a site key estiver configurada.
6. Cadastro por e-mail envia verificacao, encerra a sessao e mostra a tela de
   login. Se o perfil no Firestore falhar nesse momento, ele sera recriado no
   primeiro login com e-mail ja verificado.
7. Ao tentar entrar com e-mail ainda nao verificado, o app tenta reenviar a
   verificacao; se esse reenvio falhar, a mensagem principal continua sendo
   "Confirme seu e-mail" em vez de aparecer como falha de rede.
8. Erros do Google (`popup-blocked`, `unauthorized-domain`, etc.) continuam visiveis via `getFirebaseAuthErrorMessage`.

## Endpoint legado `/api/verify-recaptcha`

Mantido para compatibilidade, mas nao e mais usado pelo fluxo principal de login Google.

- Le `RECAPTCHA_SECRET_KEY` de `env` da Pages Function (nao de `import.meta.env`).
- Retorna mensagens claras para codigos como `invalid-input-secret` e `invalid-input-response`.
- Se `RECAPTCHA_ENTERPRISE_PROJECT_ID` e `RECAPTCHA_ENTERPRISE_API_KEY` estiverem configurados, usa a API Enterprise Assessments.

## Checklist de troubleshooting

- [ ] `ifinanca.pages.dev` esta em Firebase Auth > Authorized domains
- [ ] `ifinanca.pages.dev` esta na chave reCAPTCHA Enterprise
- [ ] `VITE_FIREBASE_APPCHECK_SITE_KEY` aponta para a site key correta
- [ ] App Check no Firebase Console usa reCAPTCHA Enterprise, nao v3 legado
- [ ] Nao ha widget manual de reCAPTCHA duplicado no frontend
- [ ] Secrets do servidor estao em Cloudflare Pages > Secrets, nao em build variables

## Erro 403 no `exchangeRecaptchaEnterpriseToken`

Se a tela mostrar "Nao foi possivel concluir a verificacao de seguranca" em `https://ifinanca.pages.dev/login` e o console do navegador exibir algo como:

```txt
403 content-firebaseappcheck.googleapis.com/.../exchangeRecaptchaEnterpriseToken
@firebase/app-check: AppCheck: 403 error
@firebase/app-check: Requests throttled due to previous 403 error
```

e o corpo da resposta vier como:

```json
{
  "error": {
    "code": 403,
    "message": "App attestation failed.",
    "status": "PERMISSION_DENIED"
  }
}
```

o problema nao e o caminho `/login`. As rotas publicas `/login` e `/cadastro` sao servidas pelo fallback SPA do Cloudflare Pages. O que precisa estar correto e a combinacao entre:

- dominio/origem: `ifinanca.pages.dev`;
- app Web Firebase: o app id configurado em `VITE_FIREBASE_APP_ID`;
- provider App Check desse app Web;
- site key reCAPTCHA Enterprise configurada em `VITE_FIREBASE_APPCHECK_SITE_KEY`;
- dominios permitidos na chave reCAPTCHA Enterprise.

Importante: no DevTools aparecem duas chaves diferentes:

- `k=...` em chamadas como `google.com/recaptcha/enterprise/anchor` e `reload`: esta e a site key do reCAPTCHA Enterprise (`VITE_FIREBASE_APPCHECK_SITE_KEY`).
- `?key=AIza...` em `content-firebaseappcheck.googleapis.com`: esta e a Firebase Web API Key (`VITE_FIREBASE_API_KEY`), nao a chave do reCAPTCHA.

Atualizar o cliente OAuth em Google Cloud > Credentials ajuda o Google Sign-In, mas nao corrige `exchangeRecaptchaEnterpriseToken`. Esse erro acontece antes do popup do Google, durante a atestacao do App Check.

Passos recomendados:

1. No Firebase Console, abra **App Check > Apps** e selecione exatamente o app Web usado por `VITE_FIREBASE_APP_ID`.
2. Confirme que o provider e **reCAPTCHA Enterprise** e que a site key e a mesma publicada como `VITE_FIREBASE_APPCHECK_SITE_KEY` no Cloudflare Pages.
3. No Google Cloud / reCAPTCHA Enterprise, abra essa mesma chave e adicione `ifinanca.pages.dev` aos dominios permitidos.
4. No Firebase Authentication, em **Settings > Authorized domains**, confirme `ifinanca.pages.dev`.
5. No Firebase App Check, confira o **limiar de risco** do app Web. Para teste, reduza temporariamente para 0.3 ou 0.1 e monitore a distribuicao de score no Google Cloud > reCAPTCHA Enterprise.
6. Em Google Cloud > APIs & Services > Credentials, confira se a Firebase Web API Key (`VITE_FIREBASE_API_KEY`) permite o referer `https://ifinanca.pages.dev/*` e as APIs Firebase usadas pelo app.
7. Teste tambem em uma janela normal sem bloqueadores de rastreamento/adblock. Navegacao privada e bloqueadores podem baixar o score do reCAPTCHA Enterprise e gerar `App attestation failed`.
8. Depois de um 403, o SDK pode aplicar throttle por ate 24h no navegador. Apos corrigir a configuracao, teste em uma nova janela anonima, outro navegador ou limpe os dados do site.

### Correção temporária para liberar login

Se o objetivo imediato for remover o bloqueio enquanto a chave Enterprise e revisada:

1. No Cloudflare Pages, remova temporariamente a build variable `VITE_FIREBASE_APPCHECK_SITE_KEY`.
2. Garanta que o enforcement do App Check esteja desativado para os produtos Firebase usados pelo app.
3. Gere um novo deploy.

Sem `VITE_FIREBASE_APPCHECK_SITE_KEY`, o frontend nao inicializa App Check e a mensagem de verificacao some. Depois que a chave Enterprise estiver correta, recoloque a variavel e faca outro deploy.
