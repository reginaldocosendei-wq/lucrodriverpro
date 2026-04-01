# Stripe Production Mismatch Report

**Data:** 2026-04-01  
**Status:** Root cause 100% confirmed via live production log analysis + connector inspection

---

## Resumo executivo

> A mensagem "Stripe não está configurado" em produção é **enganosa**.  
> O Stripe **está** configurado — mas a chave secreta que produção usa é **inválida (revogada ou pertencente a outra conta)**.

---

## O que o log de produção mostra (evidência direta)

```
[stripe] key resolved via STRIPE_SECRET_KEY env var
Error: Invalid API Key provided: sk_test_...
type: 'StripeAuthenticationError'
```

O backend encontrou a variável `STRIPE_SECRET_KEY` e a usou — mas o Stripe rejeitou a chave com `StripeAuthenticationError`.  
O backend então retornou `{ code: "stripe_auth" }` e o frontend mapeou esse código para:  
`"Stripe não está configurado. Tente o pagamento via PIX..."`

---

## Causa raiz exata: passo a passo

### 1. Como a chave Stripe é resolvida (stripeClient.ts)

O código tenta dois caminhos em ordem:

```
Caminho 1: Replit Connector API
  → Faz fetch em REPLIT_CONNECTORS_HOSTNAME com environment: "development" | "production"
  → Em produção (REPLIT_DEPLOYMENT=1): environment = "production"

Caminho 2: STRIPE_SECRET_KEY (variável de ambiente — fallback)
```

### 2. O que existe no Replit Connector

Inspecionado diretamente:

| Conexão | Environment | Status | Chave |
|---|---|---|---|
| `conn_stripe_01KMGRTDK3WCRS8SRH39C8ZM62` | **development** | healthy | `sk_test_51...` (válida) |
| *(nenhuma)* | **production** | — | — |

**Não existe nenhuma conexão Stripe configurada para `production`.**

### 3. O que acontece em preview (desenvolvimento)

- `REPLIT_DEPLOYMENT` não é `"1"` → código usa `environment: "development"`
- O connector encontra a conexão development com `sk_test_51...` válida
- Checkout funciona ✓

### 4. O que acontece em produção (publicada)

- `REPLIT_DEPLOYMENT = "1"` → código usa `environment: "production"`
- O connector não encontra nenhuma conexão production → retorna null
- Código cai no fallback: `STRIPE_SECRET_KEY` (variável de ambiente de produção)
- Essa variável contém `sk_test_...` — mas Stripe **rejeita** com `StripeAuthenticationError`
- Isso significa que a chave no secret de produção é **inválida**: revogada, digitada errada, ou de outra conta Stripe

---

## Diagnóstico completo

| Componente | Preview | Produção |
|---|---|---|
| Replit Stripe Connector (development) | ✓ Encontrado, chave válida | — |
| Replit Stripe Connector (production) | — | ✗ Não existe |
| `STRIPE_SECRET_KEY` env var | não usado (connector tem prioridade) | ✓ Encontrado, mas **chave inválida** |
| `VITE_STRIPE_PUBLIC_KEY` | não usado no checkout (backend-only) | não usado |
| Frontend recebe `code: "stripe_auth"` | N/A | ✓ Mostra "Stripe não está configurado" |

### O problema NÃO é:
- Falta de `VITE_STRIPE_PUBLIC_KEY` no frontend (o checkout é feito inteiramente pelo backend)
- Build desatualizado (o backend está sendo chamado e logando corretamente)
- Problema de rota, auth, ou CORS
- Stripe "não configurado" de verdade (a variável existe, mas está errada)

---

## Correção exata (duas opções)

### Opção A — Mais rápida (5 minutos)
**Atualizar o secret de produção `STRIPE_SECRET_KEY` com a chave correta do painel Stripe.**

1. Acesse o painel Stripe: https://dashboard.stripe.com/apikeys
2. Copie a chave correta:
   - Para ambiente de testes: `sk_test_51...` (a mesma que está no connector de development)
   - Para ambiente de produção: `sk_live_...`
3. No Replit: vá em **Secrets** → atualize (ou adicione) `STRIPE_SECRET_KEY` com esse valor **no contexto de produção**
4. **Republique o app** (obrigatório para o backend de produção pegar o novo secret)

> ⚠️ Apenas atualizar o secret sem republish **não funciona** — o backend de produção lê os secrets no momento do deploy.

### Opção B — Mais correta (10 minutos)
**Configurar o Stripe Connector para o ambiente `production` no Replit.**

1. No Replit: vá em **Integrations** → Stripe → adicione uma conexão para ambiente **production**
2. Use a chave `sk_live_...` (chave de produção real) — ou `sk_test_...` se ainda estiver em testes
3. Republique o app
4. O `stripeClient.ts` vai detectar automaticamente a conexão production e usá-la

---

## O que fazer primeiro

**Republish sozinho NÃO resolve** — o problema não é stale build, é chave inválida.

### Sequência exata:

```
1. Abrir Stripe Dashboard → https://dashboard.stripe.com/apikeys
2. Copiar sk_test_51... (ou sk_live_ para produção real)
3. Replit → Secrets → atualizar STRIPE_SECRET_KEY (produção)
4. Republish (Deploy)
5. Testar checkout em produção
```

---

## Resposta direta às suas perguntas

| Pergunta | Resposta |
|---|---|
| Por que preview funciona e produção não? | Preview usa o Replit Connector (dev, chave válida). Produção não tem connector configurado e cai no fallback com chave inválida. |
| O problema é frontend ou backend? | **100% backend** — o frontend recebe `code: "stripe_auth"` e exibe a mensagem, mas a falha é na chave secreta do servidor. |
| É build desatualizado? | Não. O backend está rodando, logando, e chegando até o Stripe antes de falhar. |
| Precisa de republish? | Sim — após corrigir o secret. Só republish sem corrigir o secret não resolve. |
| Precisa de secrets separados para produção? | Sim. Em Replit, secrets de produção são diferentes dos de desenvolvimento e precisam ser configurados explicitamente. |
| `VITE_STRIPE_PUBLIC_KEY` está causando o problema? | Não. O checkout do app não usa essa variável — é inteiramente server-side via `/api/create-checkout`. |
