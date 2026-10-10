# Verification record

Created and checked on 2026-10-07 with Node.js 24.19.0.

| Check | Outcome |
| --- | --- |
| Clean dependency install from exact historical package versions | Passed; committed npm lockfile |
| TypeScript check of app, scripts and tests | Passed |
| Application + SDK HTTP contracts | 18 tests passed, zero failed/skipped |
| Next.js production build | Passed |
| Production server HTML/health response | Passed |
| HTTP auth/CRUD/AI/checkout/cancellation/logout smoke | Passed |
| Local Shimpilot source-bound provider recognition | Five providers recognized; zero local lookalike attributions |
| Real provider network/sandbox transactions | Not run; no user credentials supplied |
| Full hosted Shimpilot scan / GitHub draft PR / merge | Not run; connect the packaged repository to your Shimpilot deployment |
| Browser visual and interactive QA | Not run; browser executable unavailable in this environment |
| Docker build / Compose | Supplied, not executed |

The Stripe, OpenAI and Supabase contract tests use the actual installed SDKs against localhost HTTP doubles. They make no real provider calls. Anthropic retired-model and AWS cloud export application actions are tested in explicit mock mode. The source binding check used selected binding modules from the inspected Shimpilot snapshot; it is not a complete scanner result.

The historical SDKs can emit deprecation warnings. They are deliberate test inputs, not an instruction to auto-upgrade all dependencies before the baseline scan. The isolated fixtures are scan inputs, not part of the app compiler's passing result.
