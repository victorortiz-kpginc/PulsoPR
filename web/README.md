# Pulso PR web

Portal web MVP standalone Blazor WebAssembly .NET 10, MudBlazor 9.11.0, Appwrite Web SDK 26.2.0. The browser SDK bridge reads and writes only the public synthetic hackathon dataset defined by `docs/backend/HACKATHON-MVP.md`. No API key or server runtime is bundled. Direct demo writes and request history are separate, non-atomic Appwrite operations; roles remain a UI simulation and are not security controls.

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

The generated local SDK bundle stays under `wwwroot/`; runtime loads public endpoint, project and database IDs from `wwwroot/appsettings.json`. Do not add keys or credentials to browser config.

## Browser validation

`node scripts/ui-smoke.cjs` uses the committed synthetic seed as an intercepted Appwrite contract stub. It checks WASM screens at desktop/mobile sizes, search, error states, profile validation/update, the request-response path and admin read-only presentation. It never contacts or mutates the remote project. `UI_INTERACTIONS_ONLY=1` limits the run to the behavioral checks. The SDK adapter also has focused Node tests in `tests/mvp-api.test.mjs`.

The UI-APPROVAL capture and gallery are at `../capture/web/index.md`; 33 post-approval PNGs are linked in its manifest. The full roster and gate evidence are in `../docs/web/UI-REVIEW.md` and `../docs/web/PROGRESS.md`.

## Demo-only limits

Appwrite schema, collection ACLs and synthetic fixture setup remain backend-owned. This client trusts the demo's open collection ACLs, uses synthetic actor IDs, and does not make profile/status/history writes transactional. The project's public domain egress has been drafted in cloud environment settings but must be reviewed and published before live-runtime reads/writes can be validated. No site was deployed.
