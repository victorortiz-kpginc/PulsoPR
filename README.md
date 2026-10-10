<p align="center">
  <img src="web/wwwroot/brand/pulsopr-logo-horizontal.svg" alt="Pulso PR" height="128">
</p>

**Pulso PR** conecta a personas que necesitan ayuda no urgente con farmacias y otros proveedores comunitarios de Puerto Rico. El MVP permite consultar proveedores, enviar y seguir solicitudes, responderlas desde el portal de proveedores y revisar la actividad desde administración.

Desarrollado por el **team de KPG.Inc**.
<p align="center">
  <img src="assets/KPG.png" alt="KPG.Inc" height="64">
</p>

Proyecto creado para el [hackathon del Caribbean AI Summit 2026](https://www.caribbeansummit.ai/es/hackathon), celebrado en San Juan, Puerto Rico. Conoce el [Caribbean AI Summit](https://www.caribbeansummit.ai/es). La página del proyecto en [Devpost](https://devpost.com/software/pulsopr) ya está reservada, pero la presentación todavía no está publicada.

> **Demo de hackathon:** usa datos ficticios de desarrollo. Los roles y algunas acciones son simulados; no uses datos personales ni esta configuración en producción.

## Demo

Encuentra apoyo comunitario en Puerto Rico:

| Área | Enlace | Acceso |
|---|---|---|
| App ciudadana (Ionic) | [Pulso PR · Apoyo cerca de ti](https://pulso-pr-app.appwrite.network/) | Ciudadanía |
| Portal web (Blazor) | [Pulso PR Web](https://pulso-pr-web.appwrite.network/) | Proveedor y administración |

Para iniciar ambas aplicaciones localmente, sigue las instrucciones de instalación de abajo.

Las cuentas son ficticias del entorno PulsoPR dev y se comparten deliberadamente para la demo:

| Rol | Correo | Contraseña |
|---|---|---|
| Ciudadanía | `ciudadano@pulso-pr.test` | `CiudadanoPR-Demo26!` |
| Proveedor | `proveedor@pulso-pr.test` | `ProveedorPR-Demo26!` |
| Administración | `administracion@pulso-pr.test` | `AdminPR-Demo26!` |

No reutilices estas contraseñas. Las cuentas no son para producción. El inicio de sesión y la navegación por rol no convierten los datos sintéticos abiertos en un sistema con autorización de producción.

## Tecnologías

- **App ciudadana:** Ionic, React, TypeScript, Vite y Capacitor; Appwrite Web SDK.
- **Portal de proveedores y administración:** Blazor WebAssembly con .NET 10, MudBlazor y Appwrite Web SDK mediante JS interop.
- **Backend:** Appwrite Cloud, con datos sintéticos y configuración de demo descrita en `backend/` y `docs/backend/`.

## Instalar y ejecutar

Requisitos: Node.js LTS y npm para app/web; .NET 10 SDK para web. Los comandos siguientes se ejecutan desde PowerShell en la raíz del repositorio.

### 1. App ciudadana

```powershell
Set-Location app
npm ci --cache .npm-cache --no-audit --no-fund
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173). La configuración pública de Appwrite está en `app/`; nunca pongas claves administrativas en la app.

### 2. Portal web

En otra terminal:

```powershell
Set-Location web
npm ci --ignore-scripts --no-audit --no-fund
npm run build:sdk
dotnet restore --locked-mode
dotnet run --no-launch-profile --urls http://localhost:5180
```

Abre [http://localhost:5180/acceso](http://localhost:5180/acceso). La configuración pública se carga desde `web/wwwroot/appsettings.json`; no necesita una API key.

### 3. Backend / Appwrite

Appwrite ya está configurado para el entorno sintético de desarrollo del MVP. Para revisar el contrato, las IDs y el estado aplicado, empieza por [la documentación backend](docs/backend/README.md). La carpeta `backend/` contiene herramientas de preparación y reconstrucción; no hace falta iniciar un servidor backend propio para levantar los dos clientes.

Si necesitas completar cuentas ficticias en otro entorno dev, sigue [el procedimiento de cuentas demo](backend/hackathon/README.md). El seed requiere una API key administrativa temporal: introdúcela sólo en el entorno local del operador, nunca en Git ni en clientes. Verifica el proyecto dev antes de ejecutarlo.

### Configuración y seguridad de la demo

Los endpoint e IDs de cliente son configuración pública. Conserva los valores locales existentes; consulta [Appwrite config](docs/backend/APPWRITE-CONFIG.md) y los README de [app](docs/app/README.md), [web](web/README.md) y [backend](backend/README.md) para detalles de cada área. No copies secretos a `appsettings.json`, assets del cliente ni archivos versionados.

## Documentación

- [Estado y plan del MVP](docs/HACKATHON.md)
- [Concepto](docs/CONCEPT.md) · [roadmap](docs/ROADMAP.md)
- [App ciudadana](docs/app/README.md)
- [Portal web](web/README.md)
- [Backend y Appwrite](docs/backend/README.md)
- [Guion de demo web](docs/web/DEMO.md)
- [Guía de desarrollo](docs/DEVELOPMENT.md)

## Licencia

Este proyecto se distribuye bajo la **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consulta el archivo [`LICENSE`](LICENSE) para los términos completos. Las dependencias y assets de terceros conservan sus propias licencias.
