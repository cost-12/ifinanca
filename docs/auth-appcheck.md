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
5. Erros do Google (`popup-blocked`, `unauthorized-domain`, etc.) continuam visiveis via `getFirebaseAuthErrorMessage`.

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
