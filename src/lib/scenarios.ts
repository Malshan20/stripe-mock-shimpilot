export const scenarios = [
  {id:'stripe-cancel',provider:'stripe',title:'Removed cancellation method',symbol:'subscriptions.del',file:'src/lib/providers/stripe.ts',expected:'Method-rename migration; payment review required',kind:'migration'},
  {id:'stripe-orders',provider:'stripe',title:'Removed Orders resource',symbol:'orders.create',file:'fixtures/legacy-orders.ts',expected:'Detect only; redesign the workflow',kind:'detect only'},
  {id:'openai-summary',provider:'openai',title:'Chat client and response shape',symbol:'createChatCompletion',file:'src/lib/providers/openai.ts',expected:'Review initialization, method and response.data',kind:'migration'},
  {id:'openai-embedding',provider:'openai',title:'Legacy embedding method',symbol:'createEmbedding',file:'src/lib/providers/openai.ts',expected:'Review method and response shape',kind:'migration'},
  {id:'openai-moderation',provider:'openai',title:'Legacy moderation method',symbol:'createModeration',file:'src/lib/providers/openai.ts',expected:'Review method and response shape',kind:'migration'},
  {id:'supabase-options',provider:'supabase',title:'Client option nesting',symbol:'createClient.options',file:'src/lib/providers/supabase.ts',expected:'Move options, preserve RLS and headers',kind:'migration'},
  {id:'supabase-auth',provider:'supabase',title:'Legacy sign-in method',symbol:'auth.signIn',file:'src/lib/providers/supabase.ts',expected:'Choose password method; update nested data',kind:'migration'},
  {id:'supabase-insert',provider:'supabase',title:'Returned mutation rows',symbol:'from.insert / from.update / from.delete',file:'src/lib/providers/supabase.ts',expected:'Preserve return contracts and row ownership',kind:'migration'},
  {id:'supabase-realtime',provider:'supabase',title:'Realtime subscription workflow',symbol:'from.on',file:'fixtures/legacy-realtime.ts',expected:'Review channel API and cleanup',kind:'fixture'},
  {id:'anthropic-model',provider:'anthropic',title:'Retired Claude model literal',symbol:'model:claude-3-5-sonnet-20241022',file:'src/lib/providers/anthropic.ts',expected:'Model replacement and prompt review',kind:'migration'},
  {id:'aws-s3',provider:'aws',title:'AWS SDK v2 S3',symbol:'S3.constructor',file:'src/lib/providers/aws.ts',expected:'Cross-package v3 migration; preserve export contract',kind:'migration'},
  {id:'aws-review',provider:'aws',title:'DocumentClient needs review',symbol:'DynamoDB.DocumentClient.constructor',file:'fixtures/aws-review-only.ts',expected:'Detect only in the inspected registry',kind:'detect only'},
  {id:'safe-controls',provider:'controls',title:'Safe calls and lookalikes',symbol:'Checkout / raw webhook / local signIn',file:'fixtures/negative-controls.ts',expected:'No invented breakages or vendor attribution',kind:'negative control'}
] as const;
