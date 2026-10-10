# Preparación de Appwrite para Pulso PR

El contrato vigente de la demo está en [`schema/pulso-pr.schema.json`](schema/pulso-pr.schema.json): Appwrite Databases (`pulso-pr`), 13 colecciones, 76 atributos, 31 índices y un bucket (`facility-images`). Las cuentas/fixtures sintéticos actuales se especifican en [`hackathon/demo.seed.json`](hackathon/demo.seed.json), con 78 municipios de referencia en [`reference-data/puerto-rico-municipalities.json`](reference-data/puerto-rico-municipalities.json).

## Instalar en un proyecto personal

Empieza por la [guía de instalación desde cero](../docs/backend/SETUP-FROM-SCRATCH.md). El script `setup/provision-fresh-project.mjs` es dry-run por defecto y sólo opera con un project ID/end-point/entorno `development` indicados. Para aplicar, requiere `--apply`, la confirmación del mismo project ID/entorno y una API key temporal en `APPWRITE_API_KEY`. Rechaza el ID compartido del hackathon y no incluye operación de crear proyecto ni crea Functions. No se ha probado contra un proyecto independiente.

El configurador `setup/configure-clients.mjs` genera IDs públicos del mismo proyecto en archivos locales ignorados: `app/.env.local` y los overrides de appsettings Blazor. La verificación `setup/verify-fresh-setup.mjs` es offline. El smoke `setup/fresh-install-smoke.mjs` usa cuentas normales, exige doble confirmación del target desarrollo, escribe una solicitud/eventos sintéticos y no debe apuntar al proyecto compartido.

Comprobaciones locales:

```powershell
npm --prefix backend test
npm --prefix backend run setup:verify
```

Los comandos de `setup/` no leen ni invocan `backend/reconstruction/dev.mcp-plan.json`.

## Artefactos históricos

- `exports/dev.schema.snapshot.json` corresponde a una observación del 9 de octubre de 2026 y antecede a `incidents` y a cuatro índices geográficos de `facilities`.
- `reconstruction/dev.mcp-plan.json` se generó a partir de ese snapshot e incluye recursos de la antigua Function. No es un plan válido para la instalación MVP actual.
- `hackathon/seed-demo-accounts.mjs` es sólo para completar cuentas en el proyecto compartido existente y tiene una guarda fija a ese ID. No lo uses para una instalación nueva.

Esos artefactos se conservan como evidencia; el schema declarativo actual y la nueva guía de instalación tienen precedencia para un proyecto limpio. La Function de comandos que permanece en el entorno compartido es opcional al cliente MVP y no se crea en Fresh Install.
