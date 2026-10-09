# Herramientas locales de preparación backend

Modo vigente: hackathon-open-synthetic. Ver docs/backend/HACKATHON-MVP.md y GOAL.md. Helper cliente en backend/hackathon/client-contract.mjs y ocho documentos demo persistidos. Configuración/exports actuales usan ACL públicas de dominio; no es backend privado de producción.

Herramientas backend de configuración/validación y código de la única Function de comandos autorizada; sin API propia. El preflight es offline. SDK cliente appwrite 26.2.0 instalado y fijado en package-lock sólo para el ensayo autorizado; no contiene claves administrativas. Cache y node_modules quedan dentro de backend/ excluidos de Git.

```powershell
node --test backend/config-preflight.test.mjs
node backend/config-preflight.mjs
node backend/render-schema.mjs
node backend/verify-schema-snapshot.mjs
node backend/schema-native-readcheck.mjs
node backend/build-reconstruction-plan.mjs
node backend/catalog-native-check.mjs
npm --prefix backend test
```

El segundo comando consume únicamente backend/appwrite.local.json, excluido por la regla raíz. No lee variables de entorno ni secretos, no llama a la red, no modifica archivos y no crea sesiones. Diagnóstico JSON sin valores de configuración. Exit 0: estructura completa; exit 2: estructura válida incompleta; exit 1: ausente/inválida/ilegible.

[appwrite.example.json](appwrite.example.json) es una plantilla con valores ficticios. La configuración real se completa mediante lectura MCP bajo AGENTS sección 11, conservando valores existentes y comprobando git check-ignore y que no esté tracked antes de escribir. No copiar credenciales ni inventar IDs ausentes.

La estructura usa configVersion 1, environment, region, endpoint, projectId, databaseId, collectionIds, bucketIds, contractVersion, sdkVersion y verifiedAt UTC. El candidato SDK es 26.2.0; el script no demuestra compatibilidad de servidor. Campos adicionales se rechazan, incluidos secretos. Los doce recursos y dos alias lógicos de un único bucket siguen el contrato v1.1; no prueban que existan.

`ready` significa sólo estructura completa: no acredita origen de valores, permisos, estado de recursos, aprobación de gates ni autorización para operar. No ejecuta ningún flujo aunque un archivo tenga ready=true. La configuración local se completó con endpoint/base/colecciones verificados; los alias facility-images/supporting-documents apuntan ahora al único bucket facility-images autorizado, por lo que preflight local devuelve ready=true sin acreditar gates.

Fuentes, limitaciones y siguiente paso en [inventario](../docs/backend/CLOUD-INVENTORY.md), [compatibilidad SDK](../docs/backend/SDK-COMPATIBILITY.md) y [progreso](../docs/backend/PROGRESS.md). Al confirmar contrato S02 revisar listas de recursos antes de adaptar este preflight.

El [schema declarativo](schema/pulso-pr.schema.json) define la base final `pulso-pr`, doce colecciones, 64 atributos y 23 índices. render-schema.mjs genera [el diccionario completo](../docs/backend/DATABASE-SCHEMA.md); schema.test.mjs comprueba nombres estables, referencias de índices, separación pública/privada y ausencia de metadata/servicios nativos duplicados. No es un archivo de configuración CLI ni exportación remota.

s01-native-probe.mjs ejecutó 34 llamadas reales sobre la fixture, guardando sólo resultados sanitizados en [S01-NATIVE-RESULTS.json](../docs/backend/S01-NATIVE-RESULTS.json). No invocarlo nuevamente: el ensayo fue detenido y sus cuentas/equipos se retiraron después de completar el diseño. .env.s01 fue eliminado tras retirar las cuentas; nunca se publicó. No es evidencia de login/email verificado.

[dev.schema.snapshot.json](exports/dev.schema.snapshot.json) captura esquema/ACL observados por lecturas MCP, sin documentos, archivos, usuarios ni credenciales. verify-schema-snapshot compara formatos nativos de atributos e índices con configuración deseada y verifica ahora el bucket compartido y no declara faltantes; un eventual exit 2 significa incompleto, no éxito pleno. schema-native-readcheck sólo lee mediante SDK guest y no captura cuerpos de documentos: doce lecturas reales y control Auth 401, sin datos privados visibles. Colecciones vacías no acreditan paginación ni flujo ciudadano.

build-reconstruction-plan compila [39 escrituras de schema y Function](reconstruction/dev.mcp-plan.json) con nombres/argumentos oficiales y comprobaciones de disponibilidad; no ejecuta ni selecciona un destino. [Guía](../docs/backend/RECONSTRUCTION.md), cobertura observada y exclusiones se conservan explícitas; no segundo bucket ni compra pendiente. No es backup ni T17 aprobado.

auth-native-check.mjs es un ensayo con efecto autorizado en dev, sólo mediante flag explícito. Usa password aleatorio y fallback-cookie nativo en memoria, sin key/OAuth de operador ni archivo de credenciales. Ejecutó registro/login/identidad/logout/invalidation; la cuenta temporal verificada fue retirada mediante MCP. No repetirlo como comando rutinario de npm test. Email verificado/recuperación y cookies de navegador/Capacitor siguen pendientes. [Resultados reales](../docs/backend/AUTH-NATIVE-RESULTS.json).

catalog-native-check es lectura SDK guest del catálogo ya aplicado: coteja [referencia pública Census](reference-data/puerto-rico-municipalities.json), pagina 25/25/25/3 y verifica code, servicio pharmacy bilingüe e índice de Facilities. [Resultados](../docs/backend/CATALOG-NATIVE-RESULTS.json). No envía solicitudes ni aprueba el flujo privado.

## Continuación v1.1

```bash
npm ci --prefix backend/functions/domain-commands --cache /workspace/PulsoPR/backend/.npm-cache --ignore-scripts
node backend/package-domain-function.mjs
node backend/build-reconstruction-plan.mjs
node backend/build-reference-plan.mjs
node backend/verify-function-snapshot.mjs
npm --prefix backend test
```

Usar la ruta real del checkout para cache. npm test incluye 23 comprobaciones de configuración/exportación y 20 adversas de comandos, todas offline. Paquete reproducible GNU tar/gzip con cinco fuentes permitidas y lockfile servidor node-appwrite 29.1.0. [Function/config](functions/domain-commands/function.json), [contrato](../docs/backend/DOMAIN-COMMANDS.md), [32 casos nativos](../docs/backend/DOMAIN-NATIVE-RESULTS.json) y [Storage gratuito](../docs/backend/STORAGE-POLICY.md).

ConfigVersion sigue 1 y contractVersion vigente v1.1; las variantes v1 anteriores se actualizan por decisión explícita. No duplicar bucket físico ni ejecutar los planes MCP sin entorno/autorización verificados. Catálogo público reconstruible aparte (79 writes) y sin datos reales. [Gates S00–S12](../docs/backend/GATE-REGISTER.md) registran pruebas pendientes externas.
