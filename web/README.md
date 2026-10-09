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

La base inicial sólo valida herramientas/interop. Los flujos se preparan con fixtures antes de UI-APPROVAL; el prototipo no acredita autenticación, seguridad ni integración remota.
