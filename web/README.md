# Pulso PR web

Portal web MVP standalone Blazor WebAssembly .NET 10, MudBlazor 9.11.0, Appwrite Web SDK 26.2.0. The approved email/password UI uses Appwrite Auth. Provider/admin routing resolves the account's confirmed Appwrite Team membership. Catalog and map require a session. No API key or server runtime is bundled. The hackathon's domain collection ACLs remain open for synthetic data, so client-side role routing is not a production security boundary.

## Cuentas de acceso de desarrollo

Web now isolates Appwrite sessions per tab with `sessionStorage` and the documented `X-Fallback-Cookies` transport, omitting shared browser cookies and the app's `cookieFallback` localStorage. Open separate new tabs to sign into different accounts simultaneously in one browser profile. Reload preserves each tab's account; normal logout ends only that session. Existing app sessions remain unchanged. Browser duplication may copy sessionStorage, so use a fresh tab for another account. Closing a tab removes local persistence; server sessions expire according to Appwrite's policies. No server session-limit setting was changed.

`node scripts/auth-session-smoke.cjs` tests isolation in one browser context using mocked API responses. `WEB_LIVE_AUTH_SMOKE=1 node scripts/auth-session-live-smoke.cjs` opts into real login/logout for the documented fictitious dev accounts and cleans up only its own sessions. Both default to the preview at `http://localhost:5185`; override `WEB_BASE_URL` when needed. No credentials or session values are printed by these tests.

Estas cuentas ficticias están creadas en el proyecto PulsoPR dev. Son únicamente para el MVP; no reutilizar sus contraseñas ni trasladarlas a producción.

| Espacio | Correo | Contraseña | Acceso asignado |
|---|---|---|---|
| Proveedor | `proveedor@pulso-pr.test` | `ProveedorPR-Demo26!` | Team `hackathon-demo-team`, rol `provider` |
| Administración | `administracion@pulso-pr.test` | `AdminPR-Demo26!` | Team `pulso-pr-admins`, rol `admin` |

La cuenta ciudadana de la app está en [docs/app/README.md](../docs/app/README.md). El seed y el procedimiento idempotente de Appwrite están en [backend/hackathon](../backend/hackathon/README.md).

From `web/` in this environment:

```bash
source scripts/env.sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build:sdk
npm run test:api
dotnet restore --locked-mode
dotnet build --no-restore
dotnet run --no-build --no-launch-profile --urls http://localhost:5180
```

On Windows PowerShell, use the same npm/dotnet commands without `source scripts/env.sh`; the local .NET 10 and Node executables are already available. Start with `dotnet run --no-build --no-launch-profile --urls http://localhost:5180` and open `/acceso`.

The generated local SDK bundle stays under `wwwroot/`; runtime loads public endpoint, project and database IDs from `wwwroot/appsettings.json`. Do not add keys or credentials to browser config.

## Browser validation

`node scripts/ui-smoke.cjs` uses the committed synthetic seed as an intercepted Appwrite contract stub. It checks WASM screens at desktop/mobile sizes, search, error states, profile validation/update, the request-response path and admin read-only presentation. It never contacts or mutates the remote project. `UI_INTERACTIONS_ONLY=1` limits the run to the behavioral checks. The SDK adapter also has focused Node tests in `tests/mvp-api.test.mjs`.

The UI-APPROVAL capture and gallery are at `../capture/web/index.md`; The current MVP v3 manifest links 11 PNGs; earlier captures are preserved under prototypes. The full roster and gate evidence are in `../docs/web/UI-REVIEW.md` and `../docs/web/PROGRESS.md`.

### Live synthetic dev smoke

`WEB_LIVE_SMOKE=1 node scripts/live-smoke.cjs` explicitly opts into creating one new fictitious request and events in the verified dev project. It uses the citizen SDK contract to submit/read, then the actual web provider UI to acknowledge/confirm and the admin UI to read the persisted result. Existing requests, schema and ACLs are preserved; test records remain synthetic. Evidence is written to ignored `web/.evidence/live-smoke.json`.

Both browser scripts need Playwright available on the host. Windows defaults to installed Edge; `BROWSER_CHANNEL` or `CHROMIUM_PATH` can select a browser. If Playwright comes from the bundled runtime, set `NODE_PATH` to the Node.js packages path returned by workspace dependencies. In PowerShell, set `$env:WEB_LIVE_SMOKE='1'` before invoking the live script. No browser/test packages are installed globally by these scripts.

`WEB_LIVE_SMOKE=1 node scripts/provider-live-smoke.cjs` creates a new fictitious provider, exercises profile/optional-field clearing, operational confirmation, services/resources, history, catalog and admin. It preserves all existing records and retains its own synthetic test fixture. Evidence goes to `.evidence/provider-live-smoke.json`. See `../docs/web/DEMO.md` for the walkthrough. Web branding v1.2 uses the mobile SVGs and blue/coral palette; approved on 2026-10-09 with current MVP screenshots recorded in the v3 manifest.

## Demo-only limits

Appwrite schema, collection ACLs and synthetic fixture setup remain backend-owned. This client trusts the demo's open collection ACLs, records Appwrite Auth user IDs for UI-level actor attribution, and does not make profile/status/history writes transactional. The local Windows browser successfully reached Appwrite and passed the live request/response smoke on 2026-10-09. The earlier cloud runtime's egress restriction is specific to that environment. No site was deployed. Data uses a snapshot of up to 100 documents per collection; reload to see changes from other clients.
