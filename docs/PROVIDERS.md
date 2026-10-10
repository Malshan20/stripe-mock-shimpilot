# Provider setup and response contracts

Global `DEMO_MODE=false` enables individual `remote` selections. Set a strong `SESSION_SECRET` in any mixed/remote setup. The default `DEMO_MODE=true` overrides all providers to mock. Restart Next.js after environment edits.

## OpenAI

```dotenv
OPENAI_MODE=remote
OPENAI_API_KEY=REPLACE_WITH_API_KEY
OPENAI_MODEL=gpt-4o-mini
```

Use a model currently available to your API project and supported by Chat Completions. The model is configurable so testing an SDK migration does not depend on a historical model remaining available. Model availability is account dependent.

The app calls Chat Completions, embeddings (`text-embedding-3-small`) and moderation (`omni-moderation-latest`) through the v3 Node SDK. `OPENAI_BASE_URL` is an optional server-only API base URL, used by the local HTTP contract tests; leave it unset for the official provider. A migration must preserve that testability or update equivalent transport setup while keeping the application contracts:

- Summary: `{ text: string, mode: 'remote' }`.
- Embedding: `{ dimensions: number, preview: number[], mode: 'remote' }`.
- Moderation: `{ flagged: boolean, mode: 'remote' }`.

The official [OpenAI v3 → v4 migration guide](https://github.com/openai/openai-node/discussions/217) documents constructor, method and response-shape changes. A method rename without fixing `response.data` is incomplete. ChatGPT Plus and API usage are separate; use an API project with available credits.

## Supabase

Use a **separate test project**. Run `supabase/schema.sql` in its SQL editor. The script creates the projects table, ownership RLS and a private `demo-files` bucket.

```dotenv
SUPABASE_MODE=remote
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=REPLACE_WITH_LEGACY_ANON_JWT
SUPABASE_BUCKET=demo-files
```

This intentionally old v1 SDK is best tested with the project's legacy anon JWT. Do not use a service-role key. The server forwards the authenticated user's access token for database and storage requests, preserving RLS. Do not put any administrative key in a `NEXT_PUBLIC_` variable.

1. Use **Create a new account** in the app.
2. If email confirmation is enabled, confirm the email and then sign in.
3. Create/update/delete a project and check returned rows in the UI.
4. Upload a file and download it.
5. Sign in as a second user and confirm the first user's records and files are invisible.

Remote signup/login deliberately uses the v1 `{ user, session, error }` contract. v2 introduces nested `data` and explicit auth methods. Mutations that use returned rows need `.select()` in v2, including matching SELECT permissions; do not "fix" a missing row by disabling RLS.

The Realtime and `auth.session`, `auth.user`, `auth.update` cases in `fixtures/` are isolated scan cases. The main UI refreshes records after mutations; it does not claim live Realtime subscriptions.

Source: [Supabase v1 → v2 upgrade guide](https://supabase.com/docs/reference/javascript/v1/upgrade-guide).

## Anthropic

The main review call intentionally contains the historical literal `claude-3-5-sonnet-20241022`. Mock mode provides a labeled sample review. Remote mode sends that literal and may return a provider error because the model is retired. That failure is a useful before-migration case, not a working-model guarantee.

```dotenv
ANTHROPIC_MODE=remote
ANTHROPIC_API_KEY=REPLACE_WITH_API_KEY
```

Use the provider's [model deprecation documentation](https://platform.claude.com/docs/en/about-claude/model-deprecations) and Shimpilot evidence to select a currently available replacement. Re-check prompts, output blocks and token limits. Model retirement and SDK version age are distinct signals.

## AWS

AWS v2 remains usable for supported existing service operations even though the SDK is out of support; end of support is not proof that the service API was removed.

For real cloud export use an existing test bucket, with an IAM identity limited to `s3:PutObject` for the `demo/*` prefix in that bucket:

```dotenv
AWS_MODE=remote
AWS_ACCESS_KEY_ID=REPLACE_WITH_TEST_IDENTITY_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_TEST_IDENTITY_SECRET
AWS_REGION=us-east-1
AWS_S3_BUCKET=REPLACE_WITH_EXISTING_TEST_BUCKET
```

The app exports owned project records as a JSON object. It never creates buckets or IAM resources. Mock mode returns the object key and byte count without storing an object in AWS. The Lambda and DocumentClient fixtures are not invoked by the app.

AWS v2 → v3 changes the dependency and client/command API. Preserve object paths, region, identity, JSON bytes and error handling. Do not let a code migration alter IAM, buckets or other cloud resources.

Sources: [AWS v2 support announcement](https://aws.amazon.com/blogs/developer/announcing-end-of-support-for-aws-sdk-for-javascript-v2/) and [AWS v3 migration guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrating.html).

## Stripe contracts

The main SDK is 10.17.0 and its explicit API version is 2020-08-27. The TypeScript cast to `Stripe.LatestApiVersion` acknowledges that this SDK publishes types for its own latest schema, while the lab intentionally calls an older API schema. Inspect the historical response shapes when changing that version.

Checkout uses a server-owned customer and subscription metadata. Webhooks verify the raw unparsed request body, reject live events, and store event IDs in a transaction before applying changes. Duplicate deliveries do not reapply changes. Subscription updates are matched to both customer and the stored subscription ID. Webhook deliveries for the same subscription can arrive out of order; this lab is not a complete production entitlement reconciler. For a real system, reconcile against the authoritative subscription and handle lifecycle ordering, refunds, disputed payments and grace periods explicitly.

Contract tests exercise the real Stripe SDK through a localhost HTTP double. `STRIPE_TEST_ORIGIN` is accepted only when `NODE_ENV=test` and only for `http://127.0.0.1`; it is not a remotely configurable production transport.

The test amount is `$12/month`. Cancellation ends the test subscription immediately. The application only enables its mock completion endpoint in mock Stripe mode; that endpoint validates the checkout's owner and does not represent a Stripe webhook.

Source for the removed cancellation method: [stripe-node v13 migration guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v13).
