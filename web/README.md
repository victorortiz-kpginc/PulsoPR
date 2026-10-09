# Pulso PR web

Portal Blazor WebAssembly standalone, .NET SDK 10.0.401, MudBlazor 9.11.0 y SDK JavaScript Appwrite 26.2.0. No servidor de reglas de negocio ni credenciales administrativas.

Desde `web/` en este entorno cloud:

```bash
source scripts/env.sh
npm ci
npm run build:sdk
dotnet restore --locked-mode
dotnet build --no-restore
dotnet run --no-build --no-launch-profile --urls http://localhost:5180
```

En otros hosts instalar .NET 10.0.401 y Node 24; configurar caches en el área web. El build necesita el bundle local `wwwroot/js/appwrite-sdk.js`, generado con npm, sin CDN en runtime.

## UI v1 en revisión

Abrir `/proveedor`. Las pantallas MVP de proveedor, catálogo y administración usan datos sintéticos en memoria. El acceso demo selecciona una experiencia; no autentica ni concede permisos. El botón superior cambia de experiencia. Los cambios y respuestas son simulados y desaparecen al recargar.

Inventario, estados y recorrido: `../docs/web/UI-REVIEW.md`. No integrar Appwrite ni avanzar S05 hasta aprobación explícita y capturas en capture/web/. Sólo entonces se cierra S04. No se ha desplegado el portal.

Desde web/, smoke con el Playwright del runtime cloud y `/usr/bin/chromium`:

```bash
node scripts/ui-smoke.cjs
```

`CHROMIUM_PATH` y `WEB_BASE_URL` permiten otros hosts. El smoke ejecuta WASM real, verifica pantallas escritorio/móvil, navegación, filtros, validación, estados y transiciones simuladas; los resultados locales quedan en `.evidence/`. No toma capturas antes de aprobación. Reiniciar el servidor después de un build que cambie sus manifests/artefactos.
