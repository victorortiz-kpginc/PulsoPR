# Instalación desde cero con un proyecto Appwrite propio

Esta guía crea un entorno de desarrollo Appwrite seleccionado por el operador y sólo usa datos ficticios. La fuente canónica del MVP actual es [schema/pulso-pr.schema.json](../../backend/schema/pulso-pr.schema.json). El aprovisionador no crea Functions ni modifica el proyecto compartido del hackathon.

## Alcance actual y estado de verificación

- Contrato actual: 1 base `pulso-pr`, 13 colecciones, 76 atributos, 31 índices y el bucket `facility-images` con CRUD público para archivos sintéticos. Las referencias oficiales son de sólo lectura; los recursos de demo usan acceso abierto propio del hackathon.
- El contrato y ambos clientes usan **Appwrite Databases (colecciones/documentos)** con Appwrite Web SDK 26.2.0. Appwrite mantiene esta API por compatibilidad, aunque recomienda TablesDB para proyectos nuevos y reserva las mejoras principales para la API nueva ([anuncio oficial](https://appwrite.io/changelog/entry/2025-08-26-2)). Se conserva el contrato para no cambiar el comportamiento actual; la instalación limpia con Databases aún debe probarse en otro proyecto Cloud.
- Datos: los 78 municipios referenciados por códigos oficiales Census y el servicio `pharmacy`, más las filas explícitas en `backend/hackathon/demo.seed.json` (todas marcadas ficticias, incluida una incidencia vencida para probar vigencia).
- Auth: tres cuentas sintéticas; el proveedor y administración reciben membresías de Teams. La app ciudadana no requiere Team.
- Aplicaciones: Ionic usa `.env.local`; Blazor WASM combina `appsettings.json` de demo con `appsettings.Development.json` o `appsettings.Production.json` local, generado por el configurador.
- No se puede crear el proyecto ni una API key con el script: Appwrite requiere que el operador cree el proyecto y la key en Console. Activar Email/Password, registrar plataformas y completar invitaciones de Team también requiere Console o interacción de usuario.
- **Sin probar en un proyecto nuevo independiente.** Se hicieron comprobaciones offline y una lectura MCP del proyecto compartido existente; nunca se ejecutó el aprovisionador o el smoke en Cloud. La lectura del proyecto compartido confirmó 13 colecciones y un bucket, pero no prueba una instalación limpia.

La instalación se define únicamente por el schema, seed y datos de referencia versionados que acompañan esta guía; no depende de una exportación del proyecto compartido.

## 1. Crear proyecto y seleccionar región

1. Entra a [Appwrite Console](https://cloud.appwrite.io/console) y crea manualmente un proyecto nuevo. Ponle un nombre que indique que es personal/de desarrollo. No selecciones ni reutilices PulsoPR dev.
2. Selecciona la región del proyecto según latencia y residencia deseada. La región se fija al crear el proyecto. Appwrite publica las regiones disponibles y endpoints en [Regions](https://appwrite.io/docs/products/network/regions); por ejemplo, NYC es `https://nyc.cloud.appwrite.io/v1`, FRA es `https://fra.cloud.appwrite.io/v1`.
3. En **Settings → General** copia el **Project ID**. El endpoint se forma con el código de región seleccionado: `https://<REGION>.cloud.appwrite.io/v1`. Confirma ambos en el encabezado/página de configuración del proyecto antes de seguir.
4. En **Auth → Settings** habilita el método **Email/Password**. No es necesario habilitar OAuth, teléfono, MFA, correo transaccional ni Functions para el MVP.

No crees la base, colecciones, índices, bucket, Teams ni cuentas a mano: el aprovisionador los reconcilia a partir del contrato versionado.

## 2. Registrar los orígenes de app y web

En **Overview → Add a platform → Web app**, añade el hostname `localhost` para desarrollo. Los puertos `5173` y `5180` no se incluyen en el hostname. Si vas a publicar los clientes, registra también el hostname exacto de cada aplicación (sin `https://` ni ruta); un mismo dominio puede servir ambas apps. Consulta [Appwrite Web quick start](https://appwrite.io/docs/quick-starts/web) para plataformas y CORS.

Si los despliegas como Appwrite Sites, termina primero el alta del Site/dominio y vuelve a añadir el hostname emitido. El dominio de la demo compartida no se añade automáticamente a tu proyecto.

## 3. Crear una API key temporal mínima

En **Overview → Integrations → API keys** (o el apartado **API Keys** del proyecto), crea una key, anota el valor sólo en el gestor seguro del operador y selecciona estos permisos:

- `databases.read`, `databases.write`
- `users.read`, `users.write`
- `teams.read`, `teams.write`
- `buckets.read`, `buckets.write`

El script crea el bucket, no sube archivos; no necesita `files.*`. No necesita `functions.*`, `sites.*`, `keys.*` ni scopes de organización. La key es secreta: nunca va en `.env.local`, `appsettings`, el navegador, Git, screenshots, logs o línea de comandos. La API key se lee sólo desde `APPWRITE_API_KEY` en el entorno del proceso. Consulta [API keys](https://appwrite.io/docs/partners/project/api-keys) y [Databases REST API](https://appwrite.io/docs/references/cloud/server-rest/databases).

## 4. Revisar el plan sin conectar

Desde la raíz, sustituye los dos valores por el ID/endpoint que copiaste. El primer comando es offline y no necesita API key:

```powershell
node backend/setup/provision-fresh-project.mjs --target-environment development --target-project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1
node backend/setup/verify-fresh-setup.mjs
```

El script rechaza explícitamente el ID compartido del hackathon. `--target-project-id` y el endpoint son obligatorios. El plan no muestra passwords. El script de aprovisionamiento es repetible: conserva los documentos/cuentas con ID estable, crea lo que falta, actualiza permisos/configuración de las colecciones y bucket conforme al contrato, y se detiene si atributos, índices, cuentas o fixtures existentes difieren. No elimina documentos/recursos ajenos. El usuario autoriza cada ejecución remota al invocar `--apply` con una key del proyecto personal.

## 5. Aprovisionar esquema, ACL, Storage, Teams, cuentas y datos demo

Si quieres que el proveedor/admin acepten invitaciones, usa correos de prueba con inboxes que controles. Las direcciones `@pulso-pr.test` del seed son sintéticas y no reciben email. Define antes de aprovisionar variables de cuenta opcionales (passwords temporales nuevos y contraseñas de cuentas sintéticas; sólo environment variables):

```powershell
$env:PULSO_DEMO_CITIZEN_EMAIL = "<inbox-ciudadano>"
$env:PULSO_DEMO_CITIZEN_PASSWORD = (Read-Host "Password sintética ciudadana" -AsSecureString | ForEach-Object { ([System.Net.NetworkCredential]::new('', $_)).Password })
$env:PULSO_DEMO_PROVIDER_EMAIL = "<inbox-proveedor>"
$env:PULSO_DEMO_PROVIDER_PASSWORD = (Read-Host "Password sintética proveedor" -AsSecureString | ForEach-Object { ([System.Net.NetworkCredential]::new('', $_)).Password })
$env:PULSO_DEMO_ADMIN_EMAIL = "<inbox-admin>"
$env:PULSO_DEMO_ADMIN_PASSWORD = (Read-Host "Password sintética administración" -AsSecureString | ForEach-Object { ([System.Net.NetworkCredential]::new('', $_)).Password })
$env:APPWRITE_PLATFORM_URL = "http://localhost"
$env:PULSO_APPWRITE_CONFIRM_PROJECT_ID = "<PROJECT_ID>"
$env:PULSO_APPWRITE_CONFIRM_ENVIRONMENT = "development"
$secureKey = Read-Host "API key temporal Appwrite" -AsSecureString
$env:APPWRITE_API_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
node backend/setup/provision-fresh-project.mjs --target-environment development --target-project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1 --apply
```

Tras terminar (o si falla), borra variables sensibles de esta terminal:

```powershell
Remove-Item Env:APPWRITE_API_KEY, Env:PULSO_APPWRITE_CONFIRM_PROJECT_ID, Env:PULSO_APPWRITE_CONFIRM_ENVIRONMENT, Env:PULSO_DEMO_CITIZEN_PASSWORD, Env:PULSO_DEMO_PROVIDER_PASSWORD, Env:PULSO_DEMO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:PULSO_DEMO_CITIZEN_EMAIL, Env:PULSO_DEMO_PROVIDER_EMAIL, Env:PULSO_DEMO_ADMIN_EMAIL, Env:APPWRITE_PLATFORM_URL -ErrorAction SilentlyContinue
Remove-Variable secureKey -ErrorAction SilentlyContinue
```

El aprovisionador recorre ordenadamente colecciones/atributos/índices y las crea con sus permisos actuales. Prepara `facility-images`, los Teams `hackathon-demo-team` y `pulso-pr-admins`, las tres cuentas, membresías y filas sintéticas. Si se creó una membresía en estado pendiente, abre el enlace recibido y acepta cada invitación desde la cuenta correspondiente; luego vuelve al smoke. Sin inbox accesible, ese paso no se puede completar con el seed `@pulso-pr.test`; usa direcciones controladas al crear el entorno.

**Sólo ejecutes `--apply` tras confirmar en Console el nombre/ID y región del proyecto personal.** Una API key de otro proyecto no permite al script crear el proyecto; el header queda limitado al ID explícito. No ejecutes el script contra el proyecto compartido.

## 6. Configurar los dos clientes con el mismo proyecto

El configurador toma database/bucket/colecciones del contrato y genera tres archivos locales ignorados por Git. Primero inspecciona el plan; después escribe:

```powershell
node backend/setup/configure-clients.mjs --project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1
node backend/setup/configure-clients.mjs --project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1 --write
```

Genera `app/.env.local`, `web/wwwroot/appsettings.Development.json` y `web/wwwroot/appsettings.Production.json`. El configurador se detiene si existen; revisa los archivos y pasa `--replace-local` sólo si confirmas que se pueden reemplazar. Son **IDs públicos**, sin API key.

La app carga variables `VITE_APPWRITE_*` de `.env.local` al iniciar Vite/build. El portal Blazor WASM carga `appsettings.json` y la configuración de su entorno (Development local, Production publicado). Los dos clientes reciben el mismo endpoint, Project ID, Database ID, Bucket ID e IDs de colecciones camelCase. No edites a mano cada constante.

Configura colecciones y buckets con IDs del contrato, no con nombres visibles. Alias legacy `supporting-documents` resuelve a `facility-images`; no se crea un segundo bucket.

## 7. Ejecutar aplicaciones

```powershell
Set-Location app
npm ci --cache .npm-cache --no-audit --no-fund
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Para publicar la app, `npm run build` incluye IDs públicos del proyecto nuevo.

En otra terminal:

```powershell
Set-Location web
npm ci --ignore-scripts --no-audit --no-fund
npm run build:sdk
dotnet restore --locked-mode
dotnet run --no-launch-profile --urls http://localhost:5180
```

Para producción, publica el proyecto Blazor en entorno `Production` con el `appsettings.Production.json` local presente. Añade luego los hostnames públicos a **Web platforms** en Console y vuelve a desplegar si tu plataforma estática cachea configuración.

## 8. Verificación y smoke de los tres roles

La comprobación de contrato es offline:

```powershell
npm --prefix backend test
npm --prefix backend run setup:verify
```

Para comprobar Cloud tras aceptar las invitaciones, ejecuta una vez el smoke con target y confirmación explícitos. Usa cuentas creadas en el proyecto nuevo. Este smoke **escribe** una solicitud y eventos sintéticos, y deja esos documentos para inspección:

```powershell
$env:PULSO_APPWRITE_CONFIRM_PROJECT_ID = "<PROJECT_ID>"
$env:PULSO_APPWRITE_CONFIRM_ENVIRONMENT = "development"
node backend/setup/fresh-install-smoke.mjs --target-environment development --target-project-id <PROJECT_ID> --endpoint https://<REGION>.cloud.appwrite.io/v1 --run
Remove-Item Env:PULSO_APPWRITE_CONFIRM_PROJECT_ID, Env:PULSO_APPWRITE_CONFIRM_ENVIRONMENT
```

Comprueba sesión ciudadana y creación de solicitud/evento, lectura y transición a `acknowledged` desde proveedor con su Team, y lectura del estado/eventos desde administración con su Team. Reporta un ID de solicitud para inspección. El test remoto se limita al endpoint/proyecto indicado; nunca uses el proyecto compartido ni datos personales reales.

Para comprobar que los clientes apuntan al proyecto nuevo, reinicia Vite y recompila el portal; abre ambos sitios, inicia sesión con las cuentas sintéticas y revisa el panel Network. `X-Appwrite-Project` debe coincidir con el ID personal y `Request URL` con el endpoint regional. También confirma en Console los documentos sintéticos creados. No compartas headers con cookies ni secretos.

## 9. Revocar key temporal

Después de que aprovisionamiento y verificación terminen, vuelve a **Overview → Integrations → API keys** y elimina la key temporal. No se necesita para ejecutar los clientes ni el smoke de usuario. Cierra la terminal local y elimina cualquier secret de variable de proceso. Si se filtró, revócala inmediatamente y crea otra sólo para repetir el trabajo.

## Limitaciones del MVP

Las ACL de dominio y Storage están abiertas para datos de demostración sintéticos; identidad y rol por Team sólo dan el recorrido visual del hackathon. No usar para producción, PII ni documentos privados. No se crean Functions, correo transaccional, dominios ni proyectos automáticamente. Un smoke verde no valida producción, privacidad o capacidad.
