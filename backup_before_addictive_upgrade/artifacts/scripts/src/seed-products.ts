import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Verificando produtos existentes no Stripe...");

  // Check if PRO product already exists
  const existing = await stripe.products.search({
    query: "name:'Lucro Driver PRO' AND active:'true'",
  });

  if (existing.data.length > 0) {
    console.log("Produto já existe:", existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    console.log("Preços ativos:");
    prices.data.forEach((p) => {
      console.log(`  - ${p.id} | ${p.unit_amount! / 100} ${p.currency} / ${p.recurring?.interval}`);
    });
    return;
  }

  console.log("Criando produto PRO...");
  const product = await stripe.products.create({
    name: "Lucro Driver PRO",
    description: "Acesso completo: lucro real, relatórios, insights e simulador",
    metadata: { tier: "pro" },
  });
  console.log("Produto criado:", product.id);

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 1990, // R$19,90
    currency: "brl",
    recurring: { interval: "month" },
    nickname: "Mensal",
  });
  console.log("Preço mensal criado:", monthly.id, "— R$19,90/mês");

  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: 14990, // R$149,90
    currency: "brl",
    recurring: { interval: "year" },
    nickname: "Anual",
  });
  console.log("Preço anual criado:", yearly.id, "— R$149,90/ano");

  console.log("\n✅ Produtos e preços criados com sucesso!");
  console.log("Os webhooks vão sincronizar os dados automaticamente.");
}

createProducts().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
