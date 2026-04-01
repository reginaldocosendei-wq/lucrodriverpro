# Stripe Production Mismatch — Root Cause Report (Final)

**Data:** 2026-04-01  
**Status:** ✅ Root cause 100% confirmed — diagnostic log added, evidence in hand

---

## Causa raiz exata

> **`STRIPE_SECRET_KEY` foi salvo com um valor de placeholder, não com a chave real.**

O startup log do servidor revela:

```
[startup] STRIPE_SECRET_KEY: SET len=11 prefix=sk_test_...
```

### O que isso significa:
- `len=11` → a variável tem **11 caracteres**
- `prefix=sk_test_...` → o valor literal é `sk_test_...` (com pontos reais)
- Uma chave Stripe real tem **~107 caracteres** (ex: `sk_test_51AbCdEfGh...`)

**Alguém salvou o texto de placeholder `sk_test_...` no campo do secret em vez da chave real.**

---

## Por que preview funciona e produção não

| Ambiente | Como resolve a chave | Resultado |
|---|---|---|
| **Preview (dev)** | Replit Connector (development) → chave `sk_test_51...` de 107 chars → **válida** | ✓ Funciona |
| **Produção** | Connector (production) → **não existe** → fallback `STRIPE_SECRET_KEY` → `sk_test_...` de 11 chars → **placeholder** | ✗ `StripeAuthenticationError` |

Em desenvolvimento, o **Replit Connector** tem uma conexão válida configurada para `environment: development`. Esse connector é consultado ANTES da variável de ambiente — então o placeholder nunca foi percebido até agora.

Em produção (`REPLIT_DEPLOYMENT=1`), o código tenta o connector com `environment: production`, **não encontra nenhuma conexão**, e cai no fallback da variável de ambiente — que é o placeholder.

---

## Confirmação via log de produção

```
[stripe] key resolved via STRIPE_SECRET_KEY env var
Error: Invalid API Key provided: sk_test_...
type: StripeAuthenticationError
```

A string `sk_test_...` (11 chars) passa no check `startsWith("sk_")` do código, então é enviada para a API do Stripe — que a rejeita imediatamente por ser inválida.

---

## O que NÃO é o problema

- ❌ Build desatualizado
- ❌ Vite env vars faltando
- ❌ `VITE_STRIPE_PUBLIC_KEY` (não é usada no checkout, que é 100% backend)
- ❌ CORS ou autenticação
- ❌ `STRIPE_PRICE_ID` ou `STRIPE_PRODUCT_ID` (não são necessários — o price ID é hardcoded no frontend)
- ❌ Webhook secret

---

## Correção exata (passo a passo)

### 1. Obter a chave real

Acesse: https://dashboard.stripe.com/test/apikeys  
Copie a **Secret key** (começa com `sk_test_51...`, tem ~107 caracteres)

### 2. Atualizar o secret no Replit

No Replit → **Secrets** → localize `STRIPE_SECRET_KEY`  
Substitua o valor atual (`sk_test_...`) pela chave real copiada do Stripe

> **Atenção:** Verifique que não há espaços no início/fim ao colar. Cole o valor exato.

### 3. Republish obrigatório

Após salvar o secret, **republique o app** — o backend de produção só lê os secrets no momento do deploy.

### 4. Confirmar no log de produção após republish

Após o deploy, o log de startup deve mostrar:
```
[startup] STRIPE_SECRET_KEY: SET len=107 prefix=sk_test_51
```
Se `len` for ~107, a chave está correta.

---

## Resposta direta

| Pergunta | Resposta |
|---|---|
| Condição exata do erro | `STRIPE_SECRET_KEY = "sk_test_..."` (placeholder de 11 chars) em vez da chave real |
| Variável faltando | Nenhuma faltando — o valor da variável existente está errado |
| Correção mais segura | Atualizar `STRIPE_SECRET_KEY` com a chave real do Stripe Dashboard |
| Republish é suficiente sozinho? | **Não** — precisa atualizar o secret ANTES de republish |
| Precisa de mudança de código? | Não — o diagnóstico já está no código. Apenas atualizar o secret e republish. |
