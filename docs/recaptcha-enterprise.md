# reCAPTCHA Enterprise — Guia de Configuração

## Visão geral

O iFinanca usa o **reCAPTCHA Enterprise** para proteger o formulário de cadastro e login contra bots. O fluxo é:

```text
Frontend (Vue) → reCAPTCHA Enterprise JS SDK
                      ↓ gera token
Frontend → POST /api/verify-recaptcha { token, siteKey, action }
                      ↓
Cloudflare Pages Function → Google reCAPTCHA Enterprise REST API
                      ↓
                 { success, score }
                      ↓
          score ≥ 0.5 → libera cadastro
          score < 0.5 → bloqueia com erro
```

---

## Diferença entre reCAPTCHA v2 e Enterprise

| Característica | v2 (siteverify) | Enterprise |
| --- | --- | --- |
| Score de risco (0.0–1.0) | ❌ | ✅ |
| Verificação de `action` | ❌ | ✅ |
| Threshold configurável | ❌ | ✅ |
| SDK necessário | Nenhum | REST API (Workers) |
| Variáveis necessárias | `RECAPTCHA_SECRET_KEY` | `RECAPTCHA_ENTERPRISE_PROJECT_ID` + `RECAPTCHA_ENTERPRISE_API_KEY` |

---

## Passo a passo de configuração

### 1. Ativar a reCAPTCHA Enterprise API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com).
2. Selecione o projeto **ascendant-shade-386022**.
3. Vá em **APIs & Services → Library**.
4. Busque por **"reCAPTCHA Enterprise API"** e clique em **Enable**.

### 2. Criar a chave reCAPTCHA Enterprise

1. No menu lateral, vá em **Security → reCAPTCHA Enterprise**.
2. Clique em **Create Key**.
3. Preencha:
   - **Display name**: `iFinanca Web`
   - **Platform type**: Web
   - **Domains**: adicione `ifinanca.pages.dev` e `localhost` (para dev)
4. Clique em **Create**.
5. Copie o **Key ID** gerado (formato: `6Lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

> [!NOTE]
> O Key ID da chave reCAPTCHA já configurada é: `6Lf_UUAtAAAAAOvmLBt2cm71wH2pkHoFWmIE8VpX` (site key atual em `.env.local`). Verifique se ele já está no Console e tem `ifinanca.pages.dev` nos domínios autorizados.

### 3. Criar a API Key para a função backend

1. Vá em **APIs & Services → Credentials**.
2. Clique em **+ Create Credentials → API Key**.
3. Após criar, clique em **Edit** na nova chave.
4. Em **API restrictions**, selecione **Restrict key** e escolha apenas **reCAPTCHA Enterprise API**.
5. Salve. Copie o valor da chave (começa com `AIza...`).

> [!CAUTION]
> Esta API Key é diferente do Site Key. Ela é um segredo — nunca exponha no frontend.

### 4. Configurar variáveis de ambiente

#### Local (`.dev.vars` — nunca commitar)

```ini
RECAPTCHA_ENTERPRISE_PROJECT_ID=ascendant-shade-386022
RECAPTCHA_ENTERPRISE_API_KEY=AIzaSy...sua-chave-aqui
RECAPTCHA_MIN_SCORE=0.5
```

#### Produção (Cloudflare Pages secrets)

```bash
# Via wrangler CLI:
npx wrangler pages secret put RECAPTCHA_ENTERPRISE_PROJECT_ID
npx wrangler pages secret put RECAPTCHA_ENTERPRISE_API_KEY
npx wrangler pages secret put RECAPTCHA_MIN_SCORE
```

Ou pelo painel: **Cloudflare Dashboard → Pages → ifinanca → Settings → Environment Variables**.

---

## Como o iFinanca usa o reCAPTCHA (Firebase App Check)

No momento, o iFinanca adota a abordagem mais segura e nativa: **Firebase App Check**.

O App Check cuida de carregar o script do reCAPTCHA Enterprise e injetar o token em todas as chamadas nativas do Firebase (Auth e Firestore) automaticamente. **Não é necessário** chamar `grecaptcha.enterprise.execute()` manualmente no frontend para proteger o login e o cadastro.

### Quando usar a rota manual `/api/verify-recaptcha`?

A rota `/api/verify-recaptcha` que construímos serve para proteger APIs customizadas que **não** passam pelo Firebase.

Se no futuro você criar uma nova Cloudflare Function (ex: enviar um e-mail, processar um pagamento) e quiser protegê-la com reCAPTCHA na interface:

1. Crie uma **segunda chave reCAPTCHA Enterprise** (tipo Score-based) no Console.
   > **Importante:** Não reutilize a chave do App Check para chamadas manuais, pois isso cria conflito de scripts e gera loops de timeout.
2. Adicione essa nova chave no `.env.local` (ex: `VITE_CUSTOM_RECAPTCHA_KEY`).
3. Chame o script e a rota da seguinte forma no frontend:

```typescript
// Exemplo para chamadas de APIs customizadas (não-Firebase)
const token = await grecaptcha.enterprise.execute(customSiteKey, { action: 'submit_payment' })

const response = await fetch('/api/verify-recaptcha', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    token,
    siteKey: customSiteKey,
    action: 'submit_payment',
  }),
})
```

Actions recomendadas:

- `register` — formulário de cadastro
- `login` — formulário de login
- `reset_password` — recuperação de senha

---

## Score de risco

| Score | Significado |
| --- | --- |
| 0.9 | Muito provavelmente humano |
| 0.5 | Limiar padrão (recomendado pelo Google) |
| 0.1 | Provavelmente bot |

Configure `RECAPTCHA_MIN_SCORE` com base no nível de segurança desejado. Comece com `0.5` e ajuste com base no painel do reCAPTCHA Enterprise.

---

## Verificar no Google Cloud Console

Após configurar, acesse o [painel reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha) para ver:

- Volume de requisições por dia
- Distribuição de scores
- Ações detectadas (register, login, etc.)
- Eventos suspeitos

---

## Snippet Google vs. implementação atual

O snippet `@google-cloud/recaptcha-enterprise` (Node.js SDK) **não funciona** em Cloudflare Workers. A função `verify-recaptcha.ts` usa a alternativa correta via REST API, que é funcionalmente equivalente e suportada no runtime V8.

| Snippet Google (Node.js SDK) | `verify-recaptcha.ts` (REST) |
| --- | --- |
| `client.createAssessment()` | `fetch('https://recaptchaenterprise.googleapis.com/v1/projects/...')` |
| `tokenProperties.valid` | `payload.tokenProperties?.valid` |
| `tokenProperties.action === recaptchaAction` | `assessedAction !== options.expectedAction` → `errorCodes: ['action-mismatch']` |
| `riskAnalysis.score` | `payload.riskAnalysis?.score` + threshold `minScore` |
