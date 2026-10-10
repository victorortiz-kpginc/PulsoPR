# Alcance del MVP de Pulso PR

Este repositorio describe el MVP presentado al hackathon del Caribbean AI Summit 2026. La demo alojada usa Appwrite y datos sintéticos.

## Flujos implementados

- Ciudadanía: autenticación de demo, búsqueda por municipio/tipo, directorio y mapa de proveedores, detalle de servicios y señales operativas sintéticas, creación y seguimiento de solicitudes.
- Proveedor: autenticación y selección de portal según membresía confirmada de Team, mantenimiento del perfil y datos operativos de demo, lectura y respuesta a solicitudes.
- Administración: panorama básico, directorio, solicitudes y actividad sintética.
- Backend reproducible: contrato versionado de Databases, datos de referencia municipal, seed ficticio, bucket Storage y scripts de configuración/verificación para un proyecto de desarrollo nuevo.

## Datos y límites

Los 78 municipios son referencia geográfica pública. El resto del dataset de demostración es ficticio. El MVP no consume un feed oficial de inventario, salud pública o emergencias; no confirma disponibilidad real ni debe usarse con PII o para emergencias.

Las cuentas de demo y la membresía de Team organizan la interfaz. El proyecto de hackathon permite operaciones abiertas sobre datos sintéticos; el enrutamiento por rol del cliente no impone autorización de servidor. Esta configuración no es adecuada para producción.

El esquema usa Appwrite Databases (colecciones/documentos), la misma familia que consume el código actual. Appwrite la considera una API legacy/deprecada. No se migró a TablesDB porque eso cambiaría el contrato y necesitaría una migración validada de ambos clientes.

## Instalación independiente

La [guía Appwrite desde cero](backend/SETUP-FROM-SCRATCH.md) documenta el proceso manual y automatizado. Las pruebas locales cubren contrato y provisioning simulado; no se ha confirmado un ensayo en un proyecto independiente de Appwrite Cloud. Ver la guía antes de provisionar y no usar el proyecto compartido para pruebas de instalación.

## Proyecto

Desarrollado por el team de KPG.Inc para el [hackathon Caribbean AI Summit 2026](https://www.caribbeansummit.ai/es/hackathon). La [página Devpost](https://devpost.com/software/pulsopr) está reservada, pero todavía no está publicada.
