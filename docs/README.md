# Lucro Driver — Documentação

## Visão geral

**Lucro Driver** é um SaaS para motoristas de aplicativo brasileiros calcularem quanto realmente sobra no bolso após todos os custos.

## Estrutura do projeto

```
/artifacts/driver-metrics/    → Frontend React (PWA + Android via Capacitor)
  src/
    pages/          → Telas do app (Home, Import, Rides, Costs, Goals, Reports)
    components/     → Componentes reutilizáveis (UI, layout, SplashScreen)
    services/       → Lógica de negócio (metricsService, importService, platformAdapters)
    hooks/          → React hooks customizados
    utils/          → Utilitários (formatters, metrics)
    lib/            → Configurações base (api.ts, utils.ts)

/artifacts/api-server/        → Backend Express
  src/
    routes/         → Rotas da API (dashboard, import, daily-summaries, rides, costs, goals, stripe, auth)
    services/       → Serviços de negócio (metricsService, importService)
    middlewares/    → Middlewares Express
    lib/            → Logger e utilidades

/lib/db/                      → Schema do banco de dados (Drizzle ORM + PostgreSQL)
  src/schema/
    users.ts        → Tabela de usuários
    rides.ts        → Corridas individuais (legado)
    costs.ts        → Despesas
    goals.ts        → Metas
    dailySummaries.ts → Resumos diários (modelo principal)

/lib/api-spec/                → OpenAPI spec + geração do client (Orval)
/lib/api-client-react/        → Client React Query gerado automaticamente
```

## Modelo de dados principal

### daily_summaries
| Campo        | Tipo    | Descrição                                      |
|--------------|---------|------------------------------------------------|
| date         | text    | Data (YYYY-MM-DD)                              |
| earnings     | real    | Ganhos totais recebidos (já líquidos)          |
| trips        | integer | Número de corridas                             |
| kmDriven     | real?   | Quilômetros rodados (opcional)                 |
| hoursWorked  | real?   | Horas trabalhadas em decimal (opcional)        |
| rating       | real?   | Avaliação média dos passageiros (0-5)          |
| platform     | text?   | Plataforma (Uber, 99, InDrive, Outro)          |

## Métricas calculadas

- **R$/corrida** = earnings / trips
- **R$/km** = earnings / kmDriven
- **R$/hora** = earnings / hoursWorked
- **Lucro real** = earnings - costs (despesas do mesmo dia)

## Regra de negócio importante

> O valor importado da screenshot é **o valor final já recebido pelo motorista**. Nunca subtrair comissão da plataforma.

## APIs principais

| Endpoint                | Método | Descrição                         |
|-------------------------|--------|-----------------------------------|
| /api/import/analyze     | POST   | Analisa screenshot com IA (GPT-4o)|
| /api/import/confirm     | POST   | Salva resumo diário               |
| /api/daily-summaries    | GET    | Lista todos os resumos            |
| /api/daily-summaries    | POST   | Cria/atualiza resumo por data     |
| /api/daily-summaries/:id| PUT    | Atualiza resumo específico        |
| /api/daily-summaries/:id| DELETE | Remove resumo                     |
| /api/dashboard/summary  | GET    | Resumo do dashboard               |
| /api/costs              | GET    | Lista despesas                    |
| /api/goals              | GET/PUT| Metas do usuário                  |

## Plataformas suportadas (adaptadores futuros)

- Uber — screnshotHint configurado
- 99 — screenshotHint configurado
- InDrive — screenshotHint configurado

## Build para Android (APK)

```bash
export VITE_API_BASE_URL=https://sua-url.replit.app
cd artifacts/driver-metrics
pnpm run build:android
pnpm run cap:sync
pnpm run cap:open  # abre Android Studio
```
