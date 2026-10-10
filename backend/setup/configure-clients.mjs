import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const schemaPath = new URL('../schema/pulso-pr.schema.json', import.meta.url);
const appSettingsPath = new URL('../../web/wwwroot/appsettings.json', import.meta.url);
const appEnvPath = new URL('../../app/.env.local', import.meta.url);
const webDevPath = new URL('../../web/wwwroot/appsettings.Development.json', import.meta.url);
const webProdPath = new URL('../../web/wwwroot/appsettings.Production.json', import.meta.url);
const sharedDemoProjectId = '6ac82de0000ae8ab05a2';
const appwriteId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

export async function buildClientConfig(projectId, endpoint) {
  if (!projectId || !appwriteId.test(projectId)) throw new Error('Indica un Project ID Appwrite válido.');
  if (projectId === sharedDemoProjectId) throw new Error('Usa el ID de un proyecto nuevo; el proyecto compartido está protegido.');
  if (!/^https:\/\/[a-z0-9-]+\.cloud\.appwrite\.io\/v1$/i.test(endpoint ?? '')) throw new Error('Endpoint no válido; usa el endpoint Cloud de la región seleccionada.');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const current = JSON.parse(await readFile(appSettingsPath, 'utf8'));
  const toCamel = value => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const collectionMap = Object.fromEntries(schema.collections.map(collection => [toCamel(collection.id), collection.id]));
  for (const id of Object.values(current.Appwrite.Collections)) {
    if (!schema.collections.some(collection => collection.id === id)) throw new Error(`Colección web no presente en el contrato: ${id}`);
  }
  const appEnv = [
    '# Configuración pública local de Appwrite; no contiene una API key.',
    'VITE_APPWRITE_ENVIRONMENT=fresh-synthetic',
    `VITE_APPWRITE_ENDPOINT=${endpoint}`,
    `VITE_APPWRITE_PROJECT_ID=${projectId}`,
    `VITE_APPWRITE_DATABASE_ID=${schema.database.id}`,
    `VITE_APPWRITE_BUCKET_ID=${schema.buckets[0].id}`,
    `VITE_APPWRITE_COLLECTIONS_JSON=${JSON.stringify(collectionMap)}`,
    '',
  ].join('\n');
  const webConfig = { Appwrite: {
    Environment: 'fresh-synthetic', Endpoint: endpoint, ProjectId: projectId,
    DatabaseId: schema.database.id, BucketId: schema.buckets[0].id, Collections: collectionMap,
  } };
  return { appEnv, webConfig };
}

export function parseArgs(argv) {
  const options = { write: false, replaceLocal: false, projectId: '', endpoint: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--write') options.write = true;
    else if (argv[i] === '--replace-local') options.replaceLocal = true;
    else if (argv[i] === '--project-id') options.projectId = argv[++i] ?? '';
    else if (argv[i] === '--endpoint') options.endpoint = argv[++i] ?? '';
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true;
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Uso: node backend/setup/configure-clients.mjs --project-id <ID> --endpoint <URL> [--write] [--replace-local]\nSin --write sólo muestra el plan. Los archivos de salida locales están ignorados por Git.');
    return;
  }
  const config = await buildClientConfig(options.projectId, options.endpoint);
  if (!options.write) {
    console.log(JSON.stringify({ mode: 'dry-run', files: ['app/.env.local', 'web/wwwroot/appsettings.Development.json', 'web/wwwroot/appsettings.Production.json'], projectId: options.projectId, endpoint: options.endpoint }, null, 2));
    return;
  }
  const { access } = await import('node:fs/promises');
  const outputs = [appEnvPath, webDevPath, webProdPath];
  const existing = [];
  for (const path of outputs) { try { await access(path); existing.push(path.pathname); } catch { /* not present */ } }
  if (existing.length && !options.replaceLocal) throw new Error(`Ya existen archivos locales (${existing.join(', ')}). Revisa y usa --replace-local si deseas sustituirlos.`);
  await Promise.all([
    writeFile(appEnvPath, config.appEnv, 'utf8'),
    writeFile(webDevPath, `${JSON.stringify(config.webConfig, null, 2)}\n`, 'utf8'),
    writeFile(webProdPath, `${JSON.stringify(config.webConfig, null, 2)}\n`, 'utf8'),
  ]);
  console.log(JSON.stringify({ mode: 'written', files: ['app/.env.local', 'web/wwwroot/appsettings.Development.json', 'web/wwwroot/appsettings.Production.json'], projectId: options.projectId, endpoint: options.endpoint }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
