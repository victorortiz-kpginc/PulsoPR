# Appwrite del MVP

El contrato actual de instalación está en [`schema/pulso-pr.schema.json`](schema/pulso-pr.schema.json), los datos sintéticos en [`hackathon/demo.seed.json`](hackathon/demo.seed.json) y los municipios de referencia en [`reference-data/puerto-rico-municipalities.json`](reference-data/puerto-rico-municipalities.json).

La guía [Instalar desde cero](../docs/backend/SETUP-FROM-SCRATCH.md) documenta la creación manual del proyecto, la key administrativa temporal, los permisos mínimos, las cuentas/Teams sintéticos, los dos clientes y el smoke de los tres roles. El aprovisionador exige proyecto y entorno de desarrollo explícitos, corre en dry-run por defecto y rechaza el ID del proyecto compartido. No crea Functions.

Validación local sin Appwrite:

```powershell
npm test
npm run setup:verify
```

No se ha verificado una instalación en un proyecto Appwrite independiente. El contrato del demo conserva ACL abiertas para facilitar el hackathon y sólo debe usarse con datos sintéticos.
