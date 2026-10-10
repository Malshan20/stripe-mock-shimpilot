import manifest from '../../package.json';
export type Provider = 'stripe' | 'openai' | 'supabase' | 'anthropic' | 'aws';
export function mode(provider: Provider): 'mock' | 'remote' {
  if (process.env.DEMO_MODE !== 'false') return 'mock';
  const value = process.env[`${provider.toUpperCase()}_MODE`] ?? 'mock';
  if (!['mock', 'remote'].includes(value)) throw new Error(`Invalid ${provider} mode`);
  return value as 'mock' | 'remote';
}
export function required(name: string) {
  const value = process.env[name];
  if (!value || value.includes('REPLACE_')) throw new Error(`Configure ${name} in .env.local`);
  return value;
}
export function appUrl() {
  const url = new URL(process.env.APP_URL ?? 'http://localhost:3000');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL must be HTTP(S)');
  return url.origin;
}
export function stripeKey() {
  const key = required('STRIPE_SECRET_KEY');
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) throw new Error('Only Stripe sandbox/test keys are allowed');
  return key;
}
export function configurations() {
  return (['stripe','openai','supabase','anthropic','aws'] as Provider[]).map(id => ({
    id, sdk: ({stripe:'stripe',openai:'openai',supabase:'@supabase/supabase-js',anthropic:'@anthropic-ai/sdk',aws:'aws-sdk'})[id], version: manifest.dependencies[({stripe:'stripe',openai:'openai',supabase:'@supabase/supabase-js',anthropic:'@anthropic-ai/sdk',aws:'aws-sdk'} as const)[id]], mode: mode(id), configured: mode(id) === 'mock' || (
      id === 'stripe' ? Boolean(process.env.STRIPE_SECRET_KEY?.match(/^(sk|rk)_test_/)) :
      id === 'supabase' ? Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) :
      id === 'aws' ? Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) :
      Boolean(process.env[`${id.toUpperCase()}_API_KEY`])
    )
  }));
}
