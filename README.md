# Shimpilot Demo Lab

A complete Next.js application built to give Shimpilot a realistic repository to inspect and migrate. It is a small SaaS workspace with login, project CRUD, AI summaries and embeddings, private uploads, Stripe subscriptions, a customer portal, cancellation, signed webhooks, and cloud exports.

**Provider SDKs are intentionally historical.** The app shell uses Next.js 16.4.0, React 19.3.0, TypeScript and Tailwind CSS. This repository is a migration lab, with explicit mock/remote modes and no automatic fallback from a failed remote call to a successful mock.

## 1. Run the app with no keys

Install **Node.js 24 LTS**, unzip this repository, and open a terminal in `shimpilot-demo`.

```bash
npm ci
```

Copy `.env.example` to `.env.local`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

Then run:

```bash
npm run dev
```

Open **http://localhost:3000**.

| Field | Demo value |
| --- | --- |
| Email | `demo@shimpilot.test` |
| Password | `DemoPass123!` |

`DEMO_MODE=true` forces all five providers into mock mode, regardless of their individual settings. Local records and uploads persist in `.data/`. Sessions use HttpOnly cookies. Sign up to test isolation between two users.

## 2. Enable real Stripe sandbox payments

Keep OpenAI, Supabase, Anthropic and AWS in mock mode while testing real Stripe.

1. Open your Stripe **sandbox** and obtain its secret test key.
2. Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Set these values in `.env.local`:

```dotenv
APP_URL=http://localhost:3000
DEMO_MODE=false
SESSION_SECRET=REPLACE_WITH_GENERATED_SECRET
STRIPE_MODE=remote
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_SANDBOX_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_AFTER_STARTING_LISTENER
OPENAI_MODE=mock
SUPABASE_MODE=mock
ANTHROPIC_MODE=mock
AWS_MODE=mock
```

4. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), log in to the matching sandbox/account, and forward events in a second terminal:

```bash
stripe login
stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3000/api/stripe/webhook
```

Copy the listener's `whsec_...` secret into `.env.local`. If you use a sandbox-specific CLI key, invoke the listener with `--api-key` set to the key for that sandbox; follow Stripe's current CLI account/sandbox instructions. The key and listener must belong to the same sandbox.

5. Restart the app after changing environment values. Open **Billing → Start test checkout**.
6. Use `4242 4242 4242 4242`, any future expiry, and any three-digit CVC.
7. Return to the app. Press **Refresh status** if the webhook has not arrived yet.
8. Enable/configure the **customer portal in that sandbox** before using the portal button.
9. Use **Cancel subscription** to exercise the actual historical `subscriptions.del` call.

No Stripe product/price IDs are needed: the backend creates inline `$12/month` price data. Prices and user IDs come from server-owned configuration. The backend rejects live API keys and events with `livemode=true`. A Checkout return URL never grants Pro access in remote mode; a verified webhook updates the plan.

The backend deliberately pins `Stripe-Version: 2020-08-27` through the SDK's `apiVersion` option. Your webhook endpoint/CLI event API version is configured separately in Stripe; align it with this integration's response expectations. After migration, re-check both versions rather than assuming an SDK update changes every API version.

More test cards: [Stripe testing](https://docs.stripe.com/testing). Webhook raw-body and CLI guidance: [Stripe webhooks](https://docs.stripe.com/webhooks).

## 3. Enable other real providers independently

See [docs/PROVIDERS.md](docs/PROVIDERS.md). Leave providers you do not need in `mock` mode. A non-Stripe provider's test environment is not a Stripe-style sandbox; real AI and cloud calls can consume credits or incur usage charges.

## 4. Use this repository with Shimpilot

Read the complete [Shimpilot demo runbook](docs/SHIMPILOT-DEMO.md).

1. Run `npm run verify` to establish a working baseline.
2. Create a **new GitHub repository** containing this app. Commit `package.json`, `package-lock.json`, `src/`, `fixtures/`, `tests/`, and the workflow.
3. Do not commit `.env.local`, `.data`, `node_modules`, or `.next`.
4. Connect this new repository through your Shimpilot GitHub App installation.
5. Refresh provider/version evidence and scan the repository.
6. Compare actual results with the case matrix; outdated SDKs alone do not guarantee findings.
7. Generate eligible migration drafts, review them, run CI, merge manually when appropriate, then rescan.

No Shimpilot API token is needed inside the target app. Shimpilot scans the GitHub repository. This app's scenario checklist is a manual review aid; it never claims to be a Shimpilot scan.

## Versions under test

| Provider | Main app dependency | Historical usage |
| --- | --- | --- |
| Stripe | `stripe@10.17.0` | API `2020-08-27`, `subscriptions.del`, isolated `orders.create` fixture |
| OpenAI | `openai@3.3.0` | `Configuration`, `OpenAIApi`, `createChatCompletion`, `createEmbedding`, `createModeration`, Axios `.data` |
| Supabase | `@supabase/supabase-js@1.35.7` | top-level client options, `auth.signIn`, implicit returned mutation rows, isolated Realtime/auth fixtures |
| Anthropic | `@anthropic-ai/sdk@0.20.9` | retired `claude-3-5-sonnet-20241022` model literal |
| AWS | `aws-sdk@2.1692.0` | S3 v2 constructor and `.promise()`, isolated DocumentClient/Lambda review fixtures |

The nested modern-control and Assistants manifests are **scan-only**, not npm workspaces. Do not install their dependencies for normal app setup. Optional Python fixtures are also scan-only.

## Verification and operation

```bash
npm run typecheck
npm test
npm run build
npm start
```

With the app running and all providers mocked, use another terminal:

```bash
npm run test:smoke
```

`npm run verify` runs typechecking, contract tests and a production build. Contract tests use local HTTP servers with the **real installed Stripe/OpenAI/Supabase SDKs**, without provider credentials or outbound provider calls. GitHub Actions also runs the actual HTTP smoke test. The regular compiler checks the executable app, tests and scripts; isolated historical fixtures are intentionally excluded from that compiler so removed workflows can still be scanned.

```bash
npm run demo:inventory
# Stop the app before resetting local test data:
npm run db:reset
```

For Docker, create `.env.local` first:

```bash
docker compose up --build
```

The Docker service binds to localhost and keeps `.data` in a named volume. Docker is optional; the native Node workflow is enough. Docker configuration is supplied, but was not executed in the creation environment.

## Project map

- `src/components/demo-app.tsx`: responsive UI and functional forms/actions.
- `src/app/api/[...path]/route.ts`: Node.js route handler entry point.
- `src/lib/api.ts`: validated endpoints and authentication boundaries.
- `src/lib/providers/`: real historical provider call sites and labeled mocks.
- `src/lib/db.ts`: SQLite persistence for local auth, billing, files, activity and mock projects.
- `supabase/schema.sql`: remote project schema, private bucket and row ownership policies.
- `fixtures/`: additional scan-only positives, modern controls, raw REST leads and Python cases.
- `tests/`: application and SDK HTTP contract tests.
- `docs/`: setup, expectations, manual demo script and verification record.

## Practical limits

This test app uses a single Node process and persistent local disk. SQLite/session/file state must remain on one machine or a persistent volume; do not deploy it as-is to an ephemeral multi-instance/serverless environment. Supabase remote mode moves project records and uploaded bytes to Supabase, while billing metadata, sessions, file references and activity still use local SQLite. The in-process rate limiter is a demo limiter. Supabase remote sessions expire after at most one hour and require signing in again; background refresh and OAuth are outside this app's implemented login flow.

A test repository can exercise scanning, supported migrations, policy review, CI and rescanning. It cannot prove every Shimpilot scheduler, GitHub permission failure or queue failure without configuring and exercising Shimpilot itself. See the runbook for those checks.
