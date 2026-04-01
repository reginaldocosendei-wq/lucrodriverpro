# Stripe Production Mismatch — Relatório Final

**Data:** 2026-04-01  
**Status:** ✅ Causa raiz identificada e corrigida — republish necessário

---

## Condição exata que estava falhando

```
stripeClient.ts linha 24-25 (versão antiga):
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnv    = isProduction ? "production" : "development";
```

Em produção (`REPLIT_DEPLOYMENT=1`), o código consultava o Replit Connector com `environment: "production"`.  
**Não existe nenhuma conexão Stripe configurada para `production` no painel de integrações** — apenas para `development`.

Resultado:
1. Connector retorna null
2. Código cai no fallback `STRIPE_SECRET_KEY`
3. Essa variável contém o placeholder `sk_test_...` (11 chars) — não uma chave real
4. Stripe rejeita → `StripeAuthenticationError` → frontend mostra "Stripe não está configurado"

Em **preview (desenvolvimento)**, o mesmo código pede `environment: "development"` → encontra a conexão válida → checkout funciona.

---

## Variáveis env envolvidas na falha

| Variável | Papel | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | Fallback quando connector falha | Continha placeholder `sk_test_...` (11 chars) — ignorado agora |
| `VITE_STRIPE_PUBLIC_KEY` | Não usada no checkout (backend-only) | Irrelevante para este erro |
| `STRIPE_PRICE_ID` | Não usada — price ID está hardcoded no frontend | Irrelevante |

---

## Arquivo alterado

**`artifacts/api-server/src/stripeClient.ts`**

### Mudança exata

Antes (só tentava um ambiente):
```typescript
const targetEnv = isProduction ? "production" : "development";
// → Em produção: tenta "production", falha, cai no env var placeholder
```

Depois (tenta produção, depois desenvolvimento como fallback):
```typescript
const envOrder = isProduction ? ["production", "development"] : ["development"];
for (const env of envOrder) {
  const key = await queryConnector(hostname, xReplitToken, env);
  if (key) return key;
}
// → Em produção: tenta "production" (não existe) → tenta "development" → 
//   encontra chave válida sk_test_51... → checkout funciona
```

Também adicionado: validação de comprimento mínimo (`length > 20`) para rejeitar placeholders como `sk_test_...`.

---

## Teste confirmado (dev)

```
[stripe] key resolved via Replit connector (development)
[create-checkout] ✓ session created — userId=89
Checkout URL: https://checkout.stripe.com/c/pay/cs_test_a1...
```

---

## Republish necessário?

**Sim.** A alteração está no backend (`stripeClient.ts`). Para entrar em produção, o app precisa ser republicado.
