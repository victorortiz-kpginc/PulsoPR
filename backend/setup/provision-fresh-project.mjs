import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHARED_DEMO_PROJECT_ID = '6ac82de0000ae8ab05a2';
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const schemaUrl = new URL('../schema/pulso-pr.schema.json', import.meta.url);
const seedUrl = new URL('../hackathon/demo.seed.json', import.meta.url);
const referencesUrl = new URL('../reference-data/puerto-rico-municipalities.json', import.meta.url);

export async function loadSetupInputs() {
  const [schema, seed, references] = await Promise.all([
    readFile(schemaUrl, 'utf8').then(JSON.parse),
    readFile(seedUrl, 'utf8').then(JSON.parse),
    readFile(referencesUrl, 'utf8').then(JSON.parse),
  ]);
  return { schema, seed, references };
}

export function parseArgs(argv) {
  const args = { apply: false, targetProjectId: '', endpoint: '', targetEnvironment: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--target-project-id') args.targetProjectId = argv[++i] ?? '';
    else if (argv[i] === '--endpoint') args.endpoint = argv[++i] ?? '';
    else if (argv[i] === '--target-environment') args.targetEnvironment = argv[++i] ?? '';
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  return args;
}

export function buildPlan({ schema, seed, references }, targetProjectId) {
  if (!targetProjectId) throw new Error('Falta --target-project-id explícito.');
  if (!APPWRITE_ID.test(targetProjectId)) throw new Error('El Project ID no tiene un formato Appwrite válido.');
  if (targetProjectId === SHARED_DEMO_PROJECT_ID || targetProjectId === seed.projectId) {
    throw new Error('El proyecto compartido del hackathon está protegido; elige un proyecto personal nuevo.');
  }
  const refDocuments = references.records.map(({ documentId, data }) => ({
    collectionId: 'municipalities', documentId, data, permissions: [],
  }));
  refDocuments.push({ collectionId: 'healthcare_services', documentId: 'pharmacy', data: {
    code: 'pharmacy', nameEs: 'Farmacia', nameEn: 'Pharmacy',
  }, permissions: [] });
  const documents = [...refDocuments, ...seed.documents];
  return {
    targetProjectId,
    databaseId: schema.database.id,
    collections: schema.collections.length,
    attributes: schema.collections.reduce((n, c) => n + c.attributes.length, 0),
    indexes: schema.collections.reduce((n, c) => n + c.indexes.length, 0),
    buckets: schema.buckets.length,
    teams: [seed.team, seed.administrationTeam].map(({ id }) => id),
    demoAccounts: seed.accounts.map(({ id }) => id),
    syntheticDocuments: documents.length,
    writes: [
      'database, collections, attributes, indexes and permissions',
      'Storage bucket and permissions', 'two Teams, three synthetic accounts and memberships',
      '78 official municipality reference rows, pharmacy service, and synthetic demo fixture rows',
    ],
    manual: [
      'Create project in Appwrite Console and register web platforms.',
      'Enable Email/Password authentication and finish any Team invitations if Appwrite marks them pending.',
      'Create and revoke the temporary API key in Appwrite Console.',
    ],
  };
}

export function resolveDemoSeed(seed, env = process.env) {
  return {
    ...seed,
    accounts: seed.accounts.map(account => {
      const role = account.role.toUpperCase();
      return {
        ...account,
        email: env[`PULSO_DEMO_${role}_EMAIL`] ?? account.email,
        password: env[`PULSO_DEMO_${role}_PASSWORD`] ?? account.password,
      };
    }),
  };
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function createProvisioner({ endpoint, projectId, apiKey, fetchImpl = fetch, sleep = wait, log = console.log }) {
  const base = endpoint.replace(/\/$/, '');
  async function request(path, { method = 'GET', body, allowNotFound = false } = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
        'Content-Type': 'application/json',
        'X-Appwrite-Response-Format': '2.4.0',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* Keep error text out of logs. */ }
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${path} falló (${response.status}, ${data.type ?? 'appwrite_error'}).`);
    return data;
  }

  async function createIfMissing(path, body, label) {
    const current = await request(path, { allowNotFound: true });
    if (current) return current;
    const created = await request(path, { method: 'POST', body });
    log(`Creado: ${label}`);
    return created;
  }

  async function waitAttribute(databaseId, collectionId, key) {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/attributes/${encodeURIComponent(key)}`;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const value = await request(path);
      if (value.status === 'available') return;
      if (value.status === 'failed') throw new Error(`El atributo ${collectionId}.${key} quedó en estado failed.`);
      await sleep(1000);
    }
    throw new Error(`Timeout esperando atributo ${collectionId}.${key}.`);
  }

  async function ensureAttribute(databaseId, collection, attribute) {
    const root = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collection.id)}/attributes`;
    const exists = await request(`${root}/${encodeURIComponent(attribute.key)}`, { allowNotFound: true });
    if (exists) {
      await waitAttribute(databaseId, collection.id, attribute.key);
      const checks = { type: attribute.type === 'double' ? 'float' : attribute.type, required: attribute.required };
      if (attribute.type === 'string') checks.size = attribute.size;
      if (attribute.type === 'enum') checks.elements = attribute.elements;
      for (const key of ['min', 'max']) if (attribute[key] !== undefined) checks[key] = attribute[key];
      if (attribute.default !== undefined && attribute.default !== null) checks.default = attribute.default;
      for (const [key, expected] of Object.entries(checks)) {
        if (JSON.stringify(exists[key]) !== JSON.stringify(expected)) throw new Error(`El atributo existente ${collection.id}.${attribute.key} difiere en ${key}; se conserva sin modificar.`);
      }
      return;
    }
    const type = attribute.type === 'double' ? 'float' : attribute.type;
    const body = { key: attribute.key, required: attribute.required };
    if (attribute.type === 'string') body.size = attribute.size;
    if (attribute.type === 'enum') body.elements = attribute.elements;
    if (attribute.min !== undefined) body.min = attribute.min;
    if (attribute.max !== undefined) body.max = attribute.max;
    if (attribute.default !== undefined && attribute.default !== null) body.default = attribute.default;
    await request(`${root}/${type}`, { method: 'POST', body });
    log(`Atributo: ${collection.id}.${attribute.key}`);
    await waitAttribute(databaseId, collection.id, attribute.key);
  }

  async function ensureIndex(databaseId, collection, index) {
    const root = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collection.id)}/indexes`;
    const path = `${root}/${encodeURIComponent(index.key)}`;
    const waitIndex = async () => {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const value = await request(path);
        if (value.status === 'available') return value;
        if (value.status === 'failed') throw new Error(`El índice ${collection.id}.${index.key} quedó en estado failed.`);
        await sleep(1000);
      }
      throw new Error(`Timeout esperando índice ${collection.id}.${index.key}.`);
    };
    let exists = await request(path, { allowNotFound: true });
    if (exists) {
      exists = await waitIndex();
      if (exists.type !== index.type || JSON.stringify(exists.attributes) !== JSON.stringify(index.attributes)
        || JSON.stringify(exists.orders ?? []) !== JSON.stringify(index.orders ?? [])) {
        throw new Error(`El índice existente ${collection.id}.${index.key} difiere; se conserva sin modificar.`);
      }
      return;
    }
    await request(root, { method: 'POST', body: {
      key: index.key, type: index.type, attributes: index.attributes,
      ...(index.orders?.length ? { orders: index.orders } : {}),
    } });
    log(`Índice: ${collection.id}.${index.key}`);
    await waitIndex();
  }

  async function ensureDocument(databaseId, fixture) {
    const path = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(fixture.collectionId)}/documents/${encodeURIComponent(fixture.documentId)}`;
    const exists = await request(path, { allowNotFound: true });
    if (exists) {
      for (const [key, value] of Object.entries(fixture.data)) {
        if (JSON.stringify(exists[key]) !== JSON.stringify(value)) {
          throw new Error(`El documento existente ${fixture.collectionId}/${fixture.documentId} difiere; se conserva sin modificar.`);
        }
      }
      return;
    }
    await request(`/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(fixture.collectionId)}/documents`, {
      method: 'POST', body: { documentId: fixture.documentId, data: fixture.data, permissions: fixture.permissions ?? [] },
    });
    log(`Documento sintético: ${fixture.collectionId}/${fixture.documentId}`);
  }

  async function ensureUser(account) {
    const path = `/users/${encodeURIComponent(account.id)}`;
    const existing = await request(path, { allowNotFound: true });
    if (existing) {
      if (existing.email !== account.email || existing.name !== account.name) {
        throw new Error(`La cuenta ${account.id} existe con datos distintos; se conserva sin modificar.`);
      }
      return;
    }
    await request('/users', { method: 'POST', body: {
      userId: account.id, email: account.email, password: account.password, name: account.name,
    } });
    log(`Cuenta sintética: ${account.id}`);
  }

  async function ensureTeam(team) {
    const path = `/teams/${encodeURIComponent(team.id)}`;
    const existing = await request(path, { allowNotFound: true });
    if (existing) {
      if (existing.name !== team.name) throw new Error(`El Team ${team.id} existe con nombre distinto.`);
      return;
    }
    await request('/teams', { method: 'POST', body: { teamId: team.id, name: team.name } });
    log(`Team: ${team.id}`);
  }

  async function ensureMembership(account, platformUrl) {
    if (!account.teamId) return;
    const teamId = encodeURIComponent(account.teamId);
    const list = await request(`/teams/${teamId}/memberships?limit=100`);
    const current = (list.memberships ?? []).find(item => item.userId === account.id);
    if (current) {
      if (!(current.roles ?? []).includes(account.role)) throw new Error(`La membresía ${account.id} tiene otro rol en ${account.teamId}.`);
      return;
    }
    await request(`/teams/${teamId}/memberships`, { method: 'POST', body: {
      roles: [account.role], userId: account.id, url: platformUrl,
    } });
    log(`Membresía creada: ${account.id} -> ${account.teamId} (complete invitation if status is pending)`);
  }

  return async function provision({ schema, seed, references, platformUrl = 'http://localhost' }) {
    const dbId = schema.database.id;
    const database = await request(`/databases/${encodeURIComponent(dbId)}`, { allowNotFound: true });
    if (database && database.name !== schema.database.name) throw new Error(`La base ${dbId} ya existe con otro nombre.`);
    if (!database) await createIfMissing('/databases', { databaseId: dbId, name: schema.database.name, enabled: true }, `base ${dbId}`);
    for (const collection of schema.collections) {
      const root = `/databases/${encodeURIComponent(dbId)}/collections`;
      const path = `${root}/${encodeURIComponent(collection.id)}`;
      const existing = await request(path, { allowNotFound: true });
      if (existing) {
        await request(path, { method: 'PUT', body: {
          name: collection.name, permissions: collection.permissions, documentSecurity: collection.documentSecurity,
        } });
      } else {
        await request(root, { method: 'POST', body: {
          collectionId: collection.id, name: collection.name, permissions: collection.permissions,
          documentSecurity: collection.documentSecurity,
        } });
        log(`Colección: ${collection.id}`);
      }
      for (const attribute of collection.attributes) await ensureAttribute(dbId, collection, attribute);
      for (const index of collection.indexes) await ensureIndex(dbId, collection, index);
    }
    for (const bucket of schema.buckets) {
      const path = `/storage/buckets/${encodeURIComponent(bucket.id)}`;
      const body = {
        name: bucket.name, permissions: bucket.permissions, fileSecurity: bucket.fileSecurity, enabled: true,
        maximumFileSize: bucket.maximumFileSize, allowedFileExtensions: bucket.allowedFileExtensions,
        compression: bucket.compression, encryption: bucket.encryption, antivirus: bucket.antivirus,
        transformations: bucket.transformations,
      };
      const existing = await request(path, { allowNotFound: true });
      if (existing) await request(path, { method: 'PUT', body });
      else { await request('/storage/buckets', { method: 'POST', body: { bucketId: bucket.id, ...body } }); log(`Bucket: ${bucket.id}`); }
    }
    await ensureTeam(seed.team);
    await ensureTeam(seed.administrationTeam);
    for (const account of seed.accounts) await ensureUser(account);
    for (const account of seed.accounts) await ensureMembership(account, platformUrl);

    const fixtures = references.records.map(({ documentId, data }) => ({ collectionId: 'municipalities', documentId, data, permissions: [] }));
    fixtures.push({ collectionId: 'healthcare_services', documentId: 'pharmacy', data: { code: 'pharmacy', nameEs: 'Farmacia', nameEn: 'Pharmacy' }, permissions: [] });
    fixtures.push(...seed.documents);
    for (const fixture of fixtures) await ensureDocument(dbId, fixture);
    return { collections: schema.collections.length, buckets: schema.buckets.length, demoAccounts: seed.accounts.length, syntheticDocuments: fixtures.length };
  };
}

const HELP = `Uso:\n  node backend/setup/provision-fresh-project.mjs --target-environment development --target-project-id <ID> --endpoint https://<REGION>.cloud.appwrite.io/v1\n  node backend/setup/provision-fresh-project.mjs --target-environment development --target-project-id <ID> --endpoint <URL> --apply\n\nDry-run es el comportamiento por defecto. Apply requiere APPWRITE_API_KEY, PULSO_APPWRITE_CONFIRM_PROJECT_ID=<mismo ID> y PULSO_APPWRITE_CONFIRM_ENVIRONMENT=development.\nNo crea proyectos; nunca acepta el ID compartido del hackathon.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  if (args.targetEnvironment !== 'development') throw new Error('Indica --target-environment development; este aprovisionador no admite producción.');
  const inputs = await loadSetupInputs();
  const plan = buildPlan(inputs, args.targetProjectId);
  if (!args.endpoint || !/^https:\/\/[a-z0-9-]+\.cloud\.appwrite\.io\/v1$/i.test(args.endpoint)) {
    throw new Error('Indica --endpoint del proyecto y región (formato https://<region>.cloud.appwrite.io/v1).');
  }
  if (!args.apply) { console.log(JSON.stringify({ mode: 'dry-run', endpoint: args.endpoint, ...plan }, null, 2)); return; }
  if (process.env.PULSO_APPWRITE_CONFIRM_PROJECT_ID !== args.targetProjectId) {
    throw new Error('PULSO_APPWRITE_CONFIRM_PROJECT_ID debe coincidir con --target-project-id.');
  }
  if (process.env.PULSO_APPWRITE_CONFIRM_ENVIRONMENT !== 'development') throw new Error('PULSO_APPWRITE_CONFIRM_ENVIRONMENT debe ser development.');
  if (!process.env.APPWRITE_API_KEY) throw new Error('APPWRITE_API_KEY debe contener la clave temporal del proyecto.');
  const provision = await createProvisioner({ endpoint: args.endpoint, projectId: args.targetProjectId, apiKey: process.env.APPWRITE_API_KEY });
  const result = await provision({ ...inputs, seed: resolveDemoSeed(inputs.seed), platformUrl: process.env.APPWRITE_PLATFORM_URL || 'http://localhost' });
  console.log(JSON.stringify({ mode: 'applied', targetProjectId: args.targetProjectId, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
