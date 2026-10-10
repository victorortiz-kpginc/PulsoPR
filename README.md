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

## Run Existing Hackathon Demo

Encuentra apoyo comunitario en Puerto Rico:

| Área | Enlace | Acceso |
|---|---|---|
| App ciudadana (Ionic) | [Pulso PR · Apoyo cerca de ti](https://pulso-pr-app.appwrite.network/) | Ciudadanía |
| Portal web (Blazor) | [Pulso PR Web](https://pulso-pr-web.appwrite.network/) | Proveedor y administración |

Esta ruta usa el entorno compartido actual de la demo. No ejecuta provisioning ni cambia recursos de Appwrite.

Las cuentas son ficticias del entorno PulsoPR dev y se comparten deliberadamente para la demo:

| Rol | Correo | Contraseña |
|---|---|---|
| Ciudadanía | `ciudadano@pulso-pr.test` | `CiudadanoPR-Demo26!` |
| Proveedor | `proveedor@pulso-pr.test` | `ProveedorPR-Demo26!` |
| Administración | `administracion@pulso-pr.test` | `AdminPR-Demo26!` |

No reutilices estas contraseñas. Las cuentas no son para producción. El inicio de sesión y la navegación por rol no convierten los datos sintéticos abiertos en un sistema con autorización de producción.

Para ejecutar la demo existente localmente, usa Node.js LTS/npm y .NET 10 SDK:

```powershell
Set-Location app
npm ci --cache .npm-cache --no-audit --no-fund
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

En otra terminal, el portal web:

```powershell
Set-Location web
npm ci --ignore-scripts --no-audit --no-fund
npm run build:sdk
dotnet restore --locked-mode
dotnet run --no-launch-profile --urls http://localhost:5180
```

La configuración versionada conserva los IDs públicos del entorno de demo. No ejecutes scripts de provisioning para seguir esta ruta.

## Install From Scratch With Your Own Appwrite Project

Esta ruta crea una instalación independiente para desarrollo. Necesitas una cuenta Appwrite y un proyecto nuevo que tú selecciones. La guía [SETUP-FROM-SCRATCH](docs/backend/SETUP-FROM-SCRATCH.md) cubre región/endpoints, altas manuales en Console, API key temporal, schema/ACL/índices, Storage, Teams, cuentas, seeds, configuración común de los dos clientes, smoke y revocación de key.

```powershell
node backend/setup/provision-fresh-project.mjs --target-environment development --target-project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1
node backend/setup/verify-fresh-setup.mjs
node backend/setup/configure-clients.mjs --project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1
node backend/setup/configure-clients.mjs --project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1 --write
```

Los comandos de provisioning son dry-run por defecto. Lee la guía y confirma el proyecto personal de desarrollo antes de invocar `--apply`; se exige confirmar el mismo ID y entorno `development`, y la clave administrativa sólo se toma de `APPWRITE_API_KEY` en el entorno del operador. El código rechaza el ID del proyecto compartido. Crear el proyecto, habilitar Email/Password, registrar hostnames, crear y revocar la API key y aceptar invitaciones de Team son pasos manuales de Console/usuario.

La verificación y tests offline se ejecutan con:

```powershell
npm --prefix backend test
npm --prefix backend run setup:verify
```

**La instalación desde cero aún no se ha probado contra un proyecto Appwrite independiente.** Los tests offline y la lectura del entorno compartido no prueban provisioning limpio. El smoke remoto escribe datos sintéticos y requiere autorización/confirmación del operador en el nuevo proyecto; sigue el paso 8 de la guía.

## Tecnologías

- **App ciudadana:** Ionic, React, TypeScript, Vite y Capacitor; Appwrite Web SDK.
- **Portal de proveedores y administración:** Blazor WebAssembly con .NET 10, MudBlazor y Appwrite Web SDK mediante JS interop.
- **Backend:** Appwrite Cloud, con datos sintéticos y configuración de demo descrita en `backend/` y `docs/backend/`.

## Documentación

- [Estado y plan del MVP](docs/HACKATHON.md)
- [Concepto](docs/CONCEPT.md) · [roadmap](docs/ROADMAP.md)
- [App ciudadana](docs/app/README.md)
- [Portal web](web/README.md)
- [Backend y Appwrite](docs/backend/README.md)
- [Instalación Appwrite desde cero](docs/backend/SETUP-FROM-SCRATCH.md)
- [Guion de demo web](docs/web/DEMO.md)
- [Guía de desarrollo](docs/DEVELOPMENT.md)

## Licencia

Este proyecto se distribuye bajo la **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consulta el archivo [`LICENSE`](LICENSE) para los términos completos. Las dependencias y assets de terceros conservan sus propias licencias.
