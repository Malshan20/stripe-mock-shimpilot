# Shimpilot end-to-end demo runbook

This repository was designed against the provider registry, reviewed rules and AST binding logic in the saved **Shimpilot-Human-Review-Complete** code snapshot inspected on 2026-10-07. That snapshot registers Stripe, OpenAI, Supabase, Anthropic and AWS. Your deployed Shimpilot version can differ; its live evidence and policy are authoritative.

## What is executable, and what is a scan fixture?

The `src/` tree is the working Next.js frontend and backend. All five providers have main-app call sites and explicit modes. The `fixtures/` tree adds historical workflows and modern controls that are never imported by the application. Fixtures remain visible to a repository scanner even though the app compiler excludes them.

`docs/AST-BINDINGS.json` records a local binding check using the inspected Shimpilot AST binding modules. It proves that the intended source-bound symbols can be recognized and local lookalike classes are not attributed to vendors. It is **not** the output of a complete hosted scan, provider refresh, migration engine or GitHub integration.

## Case matrix

All upgrade-boundary findings need reproducible installed-version evidence and an eligible newer target in Shimpilot. Keep the committed lockfile. The boundaries below are reviewed historical transitions, not invented "latest" SDK versions.

| Case | Source / symbol | Expected check in inspected snapshot |
| --- | --- | --- |
| Stripe cancellation | `src/lib/providers/stripe.ts`: `subscriptions.del` on SDK 10.17.0 | Removed in v13; bounded rename to `cancel`; payment policy still requires review |
| Stripe Orders | `fixtures/legacy-orders.ts`: `orders.create` | Removed in v11; detect-only workflow rebuild; no blind Checkout substitution |
| Stripe healthy controls | Explicit Checkout `mode`, raw webhook body, customer/portal calls in the working backend | Do not invent SDK breakages from valid modernization advice |
| OpenAI chat | `createChatCompletion` with `Configuration` / `OpenAIApi` and `.data` | v3 → v4 constructor, method and response-shape migration; compiler gate and human review |
| OpenAI embedding / moderation | `createEmbedding`, `createModeration` | Corresponding method and response-shape review |
| Supabase constructor | Top-level `schema` / `persistSession` | Move options into `db` / `auth`; preserve token forwarding and ownership |
| Supabase password login | `auth.signIn({ email, password })` | Explicit password method and nested `data.user` / `data.session` |
| Supabase returned rows | `.insert`, `.update`, `.delete` with consumed `data` | Preserve returned row contracts with appropriate `.select()` and SELECT RLS |
| Supabase auth helpers | `fixtures/legacy-realtime.ts`: `auth.user`, `auth.session`, `auth.update` | Async/new response-shape and profile handling review |
| Supabase Realtime | `.from(...).on(...).subscribe()` | Rebuild channels, filters and cleanup; source fixture only |
| Anthropic | Retired literal `claude-3-5-sonnet-20241022` | Confirm retirement evidence; review replacement model and prompt/output behavior |
| AWS main workflow | v2 `new AWS.S3()` and `.putObject(...).promise()` | v2 support transition and cross-package v3 S3 rewrite, preserving bytes/key/region/identity |
| AWS review cases | DocumentClient and Lambda constructors in `fixtures/aws-review-only.ts` | Detect-only in the inspected registry; no automatic resource or IAM changes |
| Modern controls | Nested exact-version manifests under `fixtures/modern-controls/` | Scope dependency evidence correctly; modern method names must not receive old-method findings |
| Local lookalikes | `fixtures/negative-controls.ts` | Zero source-bound provider attribution for local fake classes, strings and generic `signIn` |
| Assistants | `fixtures/assistants/workflow.ts` under a separate OpenAI v4 manifest | Coverage/sunset review; reviewed SDK-rule registry excludes generic Assistants codemods, so do not promise an automatic PR |
| Raw REST headers | `fixtures/legacy-rest.ts` | Configuration/coverage leads; do not pretend arbitrary fetch is a supported SDK rewrite |
| Optional Python | `fixtures/python/requirements.txt` and `legacy.py` | Exact old ecosystem evidence, module-level OpenAI calls and retired Claude model; no Node compiler proof for Python |

The UI shows 13 grouped cases. The scanner can report more or fewer individual findings because a group can contain several symbols or repeated call sites. Neither the grouped count nor the local AST report is a promised scan finding count.

## Phase A — record the baseline

1. Install and launch the app using `README.md`.
2. Run `npm run verify`. Preserve its output and the commit SHA.
3. With all providers mocked and the app running, run `npm run test:smoke`.
4. Sign in, create a project, edit it, generate a summary, create an embedding, moderate input, review with mock Claude, upload/download a file, complete mock checkout, open the mock portal, cancel, and export to mock cloud storage.
5. Sign up as a second user; confirm that project and file ownership boundaries hold.
6. Capture your baseline browser screenshots if you need a video demonstration.

Use a fresh test GitHub repository:

```bash
git init
git add .
git commit -m "Add Shimpilot historical SDK demo baseline"
git branch -M main
git remote add origin https://github.com/YOUR_USER/shimpilot-demo-lab.git
git push -u origin main
```

The `.gitignore` excludes credentials, sessions, records, uploaded bytes and build outputs. Commit the supplied GitHub workflow. No provider secrets are needed for CI.

## Phase B — inspect with Shimpilot

1. Install/authorize your Shimpilot GitHub App for the new repository and connect it in Shimpilot.
2. Ensure provider monitoring/version refresh succeeds before concluding a missing finding is a scanner bug.
3. Run a scan of the committed default branch and record the scan ID and commit SHA.
4. Check exact package/lockfile versions, nearest-manifest scoping, provider/source evidence, paths, line numbers, symbols, coverage classifications and the case matrix.
5. Confirm local lookalikes are not incorrectly attributed. Modern controls and unsupported REST surfaces should not receive fabricated old-SDK findings.
6. If public scanning is enabled in your Shimpilot deployment, repeat against the public repository without credentials and compare coverage, limits and state behavior. Public mode can have different permissions or limits from connected scanning.

If a positive case is absent, check the target SDK/version evidence, monitored change eligibility, freshness, dependency scope, source binding and scan completeness. An old package by itself is not proof that a relevant upstream change applies.

## Phase C — migration, policy and PR review

Start with **Stripe cancellation**, a small removed-method case. Inspect whether sensitive payment policy downgrades any otherwise automatic capability. Do not weaken policy just to force a demo to appear successful.

For each eligible draft:

1. Confirm its source commit, finding/rule identity, evidence and supported automation capability.
2. Check the changed source, dependency manifest and regenerated lockfile.
3. Require relevant validation to pass. An unavailable check is not a passed check.
4. Run `npm ci`, `npm run verify` and the HTTP smoke test on the draft branch.
5. Re-run the application's workflows affected by the migration.
6. Review and merge according to the real Shimpilot policy.
7. Scan the merged commit and verify that the specific migrated rule no longer appears at the repaired call site.

For **OpenAI**, verify constructor initialization, API base URL/test transport, method names, error handling and the change from Axios `.data` to direct result objects. A method-only diff should fail the appropriate checks.

For **Supabase**, verify returned mutation rows and auth response shapes, not just method names. Keep user JWTs, RLS and file ownership. A migration must not remove authorization to make tests pass.

For **AWS**, preserve region, IAM identity, bucket, object prefix, JSON content and return contract. `aws-sdk` → service-specific v3 packages is a cross-package migration; v2 end of support does not imply that S3 stopped working.

For **Anthropic**, inspect provider retirement evidence and the replacement model's availability and behavior. Do not claim the legacy retired-model request should work remotely before repair.

Detect-only Orders, DocumentClient and Lambda cases may remain after other migrations. The app compiler deliberately does not certify scan-only fixtures; independently inspect those diffs and use the fixture's own manifest/compiler/test requirements if you enable that workflow.

## Phase D — real Stripe sandbox demonstration

Enable remote Stripe using `README.md`, with other providers still mocked. Keep Stripe CLI forwarding events from the same sandbox. Demonstrate:

- Successful hosted Checkout and verified webhook plan activation.
- User cancellation/abandoned checkout without accidental activation.
- Hosted billing portal after sandbox portal configuration.
- Immediate test subscription cancellation before and after the method migration.
- Invalid signature rejection; duplicate event receipts are idempotent.
- Live key/live event rejection.

Use real Checkout sessions created by this app for entitlement checks. `stripe trigger checkout.session.completed` creates generic fixture data; it need not contain this user's customer/checkout IDs and therefore need not activate the user's plan. Local automated tests cover forged/tampered and duplicate events without reaching Stripe.

## Phase E — capabilities requiring Shimpilot-side setup

These cannot be proven by the target repository alone. Exercise them in Shimpilot's own test environment and record the actual outcome:

| Capability | Concrete test |
| --- | --- |
| Scheduled monitoring | Configure a scan schedule, wait for an actual scheduled run, compare job and scan timestamps |
| Upstream release monitoring | Refresh a provider feed and inspect stored source-backed evidence; do not invent a release event in this app |
| Queues/retries | Induce a controlled worker failure in a Shimpilot test instance and check retry and terminal-failure state |
| GitHub permissions | Use a separate test installation with limited access; inspect truthful errors and recovery |
| Draft PR deduplication | Request the same eligible migration twice and inspect the actual PR/finding identity behavior |
| Validation failure | Use a temporary test branch with a real compiler/test failure and verify blocked/failed validation is not labeled passed |
| Merge conflict | Create a conflicting edit on a test branch and inspect the actual policy/recovery behavior |
| Post-merge inspection | Merge a verified test draft, then inspect the scan of the actual merged commit |

Do not change your production Shimpilot repository or provider infrastructure to simulate these cases. Use the new target repository and a separate Shimpilot test instance when needed.

## Reset and repeat

Keep the baseline commit. Create a fresh branch from it for each independent migration demo. Shut down the app and run `npm run db:reset` to reset the default local database/uploads. That command does not change provider resources. Cancel test subscriptions separately in the Stripe sandbox when cleaning up.

## What success means

A useful demonstration shows accurate version evidence, traceable real call sites, honest coverage, policy-appropriate migration work, passing relevant checks, preserved application behavior, and a rescan of the actual merged commit. It does not require every fixture to become a PR or every finding to disappear after one migration.
