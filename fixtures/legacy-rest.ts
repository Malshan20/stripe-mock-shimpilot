// Scan-only raw REST lead. Do not claim AST migration coverage for arbitrary fetch.
export async function historicalStripeRest() {
  return fetch('https://api.stripe.com/v1/balance',{headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2020-08-27'}});
}
export async function oldAssistantsRest() {
  return fetch('https://api.openai.com/v1/assistants',{headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'OpenAI-Beta':'assistants=v2'}});
}
