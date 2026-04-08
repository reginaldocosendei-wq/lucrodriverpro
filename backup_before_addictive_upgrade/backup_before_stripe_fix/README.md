# Backup — Estado estável antes do Stripe fix

**Data:** 2026-04-01  
**Hora:** gerado automaticamente na sessão de trabalho  
**Commit de referência:** ver `git log --oneline -1` no projeto principal

---

## Nota

> **Versão estável com autenticação funcionando, PIX manual e ativação PRO.**

Esta pasta é um snapshot estático do código-fonte no momento em que:

- Autenticação (register / login) funcionando em produção
- Sessão com cookie `SameSite=None; Secure` corrigido para ambiente Replit
- PIX manual funcionando (fluxo completo: solicitação → aprovação admin → PRO ativo)
- PIX automático desativado temporariamente (tela "em breve" com fallback manual)
- Ativação PRO manual via painel admin (`/api/admin/activate-pro`) implementada
- Stripe (cartão) funcional com trial de 7 dias
- Webhook Stripe sem `STRIPE_WEBHOOK_SECRET` → validação de assinatura pulada, mas fluxo operacional

---

## ⚠️ Aviso

> **Usado antes do Stripe fix.**  
> Se as alterações no Stripe quebrarem alguma coisa, use este backup para restaurar o estado estável.

---

## Estrutura do backup

```
backup_before_stripe_fix/
├── api-server/          ← backend Express (src/ completo)
│   ├── src/
│   │   ├── routes/      ← auth, rides, costs, pix, stripe, admin, mercadopago, ...
│   │   ├── lib/         ← planSync, computeEffectivePlan
│   │   ├── index.ts     ← entrypoint do servidor (cookie fix, CORS, session)
│   │   ├── paymentService.ts
│   │   ├── storage.ts
│   │   ├── stripeClient.ts
│   │   ├── mercadopagoService.ts
│   │   └── webhookHandlers.ts
│   └── package.json
├── driver-metrics/      ← frontend React + Vite (src/ completo)
│   ├── src/
│   │   ├── pages/       ← Home, auth, upgrade, pix-auto, pix-payment, admin-*, ...
│   │   ├── components/  ← layout, AdminActivatePanel, ...
│   │   └── lib/         ← api, i18n, hooks, utils
│   ├── vite.config.ts
│   ├── index.html
│   └── package.json
├── lib-db/              ← schema Drizzle (usersTable, pixPaymentsTable, ...)
│   └── src/
└── README.md            ← este arquivo
```

---

## Como restaurar (se necessário)

1. Copie os arquivos do backup de volta para os diretórios originais:
   ```bash
   cp -r backup_before_stripe_fix/api-server/src/    artifacts/api-server/src
   cp -r backup_before_stripe_fix/driver-metrics/src/ artifacts/driver-metrics/src
   cp -r backup_before_stripe_fix/lib-db/src/         lib/db/src
   ```
2. Reinicie os workflows (API Server + driver-metrics: web)
3. Verifique login, PIX manual e ativação PRO

---

## Variáveis de ambiente necessárias (todas já configuradas em produção)

| Variável | Status |
|---|---|
| `DATABASE_URL` | SET |
| `SESSION_SECRET` | SET |
| `STRIPE_SECRET_KEY` | SET |
| `ADMIN_SECRET` | SET |
| `VITE_ADMIN_EMAIL` | SET |
| `VITE_ADMIN_SECRET` | SET |
| `STRIPE_WEBHOOK_SECRET` | ausente — webhooks sem validação de assinatura |
| `MERCADOPAGO_ACCESS_TOKEN` | ausente — PIX auto desativado |
| `APP_BASE_URL` | ausente — fallback hardcoded para lucrodriverpro.com |
