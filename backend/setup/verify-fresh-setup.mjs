import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const sharedDemoProjectId = '6ac82de0000ae8ab05a2';

export async function inspectOfflineSetup() {
  const [schema, seed, reference, appSettings, appConfigSource] = await Promise.all([
    readFile(new URL('../schema/pulso-pr.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../hackathon/demo.seed.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../reference-data/puerto-rico-municipalities.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../web/wwwroot/appsettings.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../app/src/domain/config.ts', import.meta.url), 'utf8'),
  ]);
  const collectionIds = new Set(schema.collections.map(collection => collection.id));
  if (schema.collections.length !== 13) throw new Error(`Contrato esperado: 13 colecciones; encontradas ${schema.collections.length}.`);
  if (reference.count !== 78 || reference.records.length !== 78) throw new Error('El seed debe incluir los 78 municipios sintéticos de referencia.');
  if (seed.accounts.length !== 3 || seed.documents.length < 1) throw new Error('Faltan cuentas o documentos sintéticos de demo.');
  if (schema.buckets.length !== 1 || schema.buckets[0].id !== 'facility-images') throw new Error('El bucket de cliente no coincide con el contrato actual.');
  if (!seed.projectId || seed.projectId !== sharedDemoProjectId) throw new Error('El seed documentado ya no está identificado como la fixture histórica compartida.');
  for (const document of seed.documents) if (!collectionIds.has(document.collectionId)) throw new Error(`Fixture apunta a colección desconocida: ${document.collectionId}`);
  const webIds = Object.values(appSettings.Appwrite.Collections);
  if (webIds.length !== collectionIds.size || webIds.some(id => !collectionIds.has(id))) throw new Error('El mapa de colecciones del portal no coincide con el schema canónico.');
  if ([...collectionIds].some(id => !appConfigSource.includes(`'${id}'`))) throw new Error('Falta un ID del schema en la configuración centralizada de la app.');
  if (appSettings.Appwrite.DatabaseId !== schema.database.id || appSettings.Appwrite.BucketId !== schema.buckets[0].id
    || !appConfigSource.includes(`'${schema.database.id}'`) || !appConfigSource.includes(`'${schema.buckets[0].id}'`)) {
    throw new Error('Database/Bucket ID no coincide entre clientes y contrato.');
  }
  for (const key of ['Endpoint', 'ProjectId', 'DatabaseId', 'BucketId']) {
    if (!appSettings.Appwrite[key]) throw new Error(`Falta Appwrite.${key} en la configuración web existente.`);
  }
  const attrs = schema.collections.reduce((count, collection) => count + collection.attributes.length, 0);
  const indexes = schema.collections.reduce((count, collection) => count + collection.indexes.length, 0);
  return { mode: 'offline-contract-check', databaseId: schema.database.id, collections: schema.collections.length, attributes: attrs, indexes, buckets: schema.buckets.length, municipalities: reference.count, demoAccounts: seed.accounts.length, fixtures: seed.documents.length, webCollectionIds: webIds.length, remote: 'not checked' };
}

async function main() {
  const result = await inspectOfflineSetup();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
