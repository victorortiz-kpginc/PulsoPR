# Portal Pulso PR

Portal Blazor WebAssembly con .NET 10, MudBlazor y Appwrite Web SDK. Ofrece los flujos de proveedor y administración del [MVP](../docs/MVP-SCOPE.md).

Para usar el demo alojado, consulta las URLs y cuentas ficticias del [README principal](../README.md). Para conectar un proyecto Appwrite propio, sigue la [guía de instalación](../docs/backend/SETUP-FROM-SCRATCH.md); el configurador genera appsettings locales con IDs públicos y nunca incluye API keys.

## Desarrollo

Requisitos: Node.js 24/npm y .NET 10 SDK. Desde `web/`:

```powershell
npm ci --ignore-scripts
npm run build:sdk
npm run test:api
dotnet restore --locked-mode
dotnet build --no-restore
dotnet run --no-build --no-launch-profile --urls http://localhost:5180
```

La demo y los seeds usan datos ficticios. El enrutamiento por membresía de Team organiza la vista y no constituye una frontera de seguridad de servidor. No uses este portal con información personal o en producción.
