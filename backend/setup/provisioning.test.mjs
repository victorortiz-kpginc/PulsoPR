import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, createProvisioner, loadSetupInputs, parseArgs, resolveDemoSeed } from './provision-fresh-project.mjs';
import { buildClientConfig, parseArgs as parseClientArgs } from './configure-clients.mjs';
import { inspectOfflineSetup } from './verify-fresh-setup.mjs';

test('current setup contract covers schema, public references, accounts and demo fixtures', async () => {
  const inputs = await loadSetupInputs();
  const plan = buildPlan(inputs, 'fresh-pulso-test-project');
  assert.equal(plan.collections, 13);
  assert.equal(plan.buckets, 1);
  assert.equal(plan.demoAccounts.length, 3);
  assert.equal(plan.syntheticDocuments, 78 + 1 + inputs.seed.documents.length);
  assert.ok(plan.writes.some(step => step.includes('Storage')));
  assert.ok(plan.manual.some(step => step.includes('Email/Password')));
});

test('provisioner rejects the shared hackathon project and requires explicit target flags', async () => {
  const inputs = await loadSetupInputs();
  assert.throws(() => buildPlan(inputs, '6ac82de0000ae8ab05a2'), /compartido/);
  assert.throws(() => buildPlan(inputs, ''), /explícito/);
  assert.deepEqual(parseArgs(['--target-environment', 'development', '--target-project-id', 'personal-dev', '--endpoint', 'https://fra.cloud.appwrite.io/v1']), {
    apply: false, targetProjectId: 'personal-dev', endpoint: 'https://fra.cloud.appwrite.io/v1', targetEnvironment: 'development',
  });
});

test('client config uses only public IDs and emits matching app and web project settings', async () => {
  const config = await buildClientConfig('personal-dev-project', 'https://fra.cloud.appwrite.io/v1');
  assert.match(config.appEnv, /VITE_APPWRITE_PROJECT_ID=personal-dev-project/);
  assert.match(config.appEnv, /VITE_APPWRITE_DATABASE_ID=pulso-pr/);
  assert.equal(config.webConfig.Appwrite.ProjectId, 'personal-dev-project');
  assert.equal(config.webConfig.Appwrite.Endpoint, 'https://fra.cloud.appwrite.io/v1');
  assert.equal(config.webConfig.Appwrite.BucketId, 'facility-images');
  await assert.rejects(buildClientConfig('6ac82de0000ae8ab05a2', 'https://fra.cloud.appwrite.io/v1'), /compartido/);
  await assert.rejects(buildClientConfig('personal-dev-project', 'https://nyc.cloud.appwrite.io'), /Endpoint/);
  assert.equal(parseClientArgs(['--project-id', 'p', '--endpoint', 'https://fra.cloud.appwrite.io/v1']).write, false);
});

test('fresh synthetic account overrides are read from the operator environment without logging credentials', async () => {
  const { seed } = await loadSetupInputs();
  const adjusted = resolveDemoSeed(seed, { PULSO_DEMO_CITIZEN_EMAIL: 'citizen@example.test', PULSO_DEMO_CITIZEN_PASSWORD: 'operator-password' });
  assert.equal(adjusted.accounts[0].email, 'citizen@example.test');
  assert.equal(adjusted.accounts[0].password, 'operator-password');
  assert.equal(adjusted.accounts[1].email, seed.accounts[1].email);
});

test('provisioner is idempotent against a mocked empty and then populated Appwrite API', async () => {
  const resources = new Map();
  const memberships = new Map();
  const calls = [];
  const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    const path = url.pathname.replace(/^\/v1/, '');
    const method = init.method;
    calls.push({ method, path });
    assert.equal(new Headers(init.headers).get('X-Appwrite-Project'), 'personal-dev');
    assert.equal(new Headers(init.headers).get('X-Appwrite-Key'), 'operator-test-key');
    const body = init.body ? JSON.parse(init.body) : {};
    if (method === 'GET') {
      if (path.endsWith('/memberships')) return respond({ memberships: memberships.get(path) ?? [] });
      if (resources.has(path)) return respond(resources.get(path));
      return respond({ type: 'not_found' }, 404);
    }
    if (method === 'POST') {
      let savedPath = path;
      let value = body;
      if (path === '/databases') savedPath = `/databases/${body.databaseId}`;
      else if (path.endsWith('/collections')) savedPath = `${path}/${body.collectionId}`;
      else if (path.includes('/attributes/')) {
        savedPath = `${path.slice(0, path.lastIndexOf('/'))}/${body.key}`;
        value = { ...body, type: path.slice(path.lastIndexOf('/') + 1), status: 'available' };
      } else if (path.endsWith('/indexes')) savedPath = `${path}/${body.key}`;
      else if (path === '/storage/buckets') savedPath = `/storage/buckets/${body.bucketId}`;
      else if (path === '/teams') savedPath = `/teams/${body.teamId}`;
      else if (path === '/users') savedPath = `/users/${body.userId}`;
      else if (path.endsWith('/memberships')) {
        const list = memberships.get(path) ?? [];
        memberships.set(path, [...list, { userId: body.userId, roles: body.roles }]);
        return respond({ $id: 'membership' }, 201);
      } else if (path.endsWith('/documents')) savedPath = `${path}/${body.documentId}`;
      if (path.includes('/indexes')) value = { ...body, status: 'available' };
      if (path.endsWith('/documents')) value = { $id: body.documentId, ...body.data };
      resources.set(savedPath, value);
      return respond(value, 201);
    }
    if (method === 'PUT') {
      resources.set(path, body);
      return respond(body);
    }
    throw new Error(`Unexpected method ${method} ${path}`);
  };
  const provision = await createProvisioner({ endpoint: 'https://fra.cloud.appwrite.io/v1', projectId: 'personal-dev', apiKey: 'operator-test-key', fetchImpl, sleep: async () => {}, log: () => {} });
  const schema = {
    database: { id: 'pulso-pr', name: 'Pulso PR' },
    collections: [
      { id: 'healthcare_services', name: 'HealthcareServices', permissions: ['read("any")'], documentSecurity: true,
        attributes: [{ key: 'code', type: 'string', size: 64, required: true }], indexes: [] },
      { id: 'things', name: 'Things', permissions: ['read("any")'], documentSecurity: true,
      attributes: [{ key: 'title', type: 'string', size: 64, required: true }],
      indexes: [{ key: 'idx_title', type: 'key', attributes: ['title'], orders: ['ASC'] }] },
    ],
    buckets: [{ id: 'facility-images', name: 'Pulso PR Assets', permissions: ['read("any")'], fileSecurity: true,
      maximumFileSize: 1024, allowedFileExtensions: ['jpg'], compression: 'none', encryption: true, antivirus: true, transformations: true }],
  };
  const seed = { team: { id: 'provider-team', name: 'Providers' }, administrationTeam: { id: 'admin-team', name: 'Admins' }, accounts: [
    { id: 'citizen', email: 'citizen@example.test', name: 'Citizen', password: 'synthetic-password', role: 'citizen' },
    { id: 'provider', email: 'provider@example.test', name: 'Provider', password: 'synthetic-password', role: 'provider', teamId: 'provider-team' },
    { id: 'administrator', email: 'admin@example.test', name: 'Admin', password: 'synthetic-password', role: 'admin', teamId: 'admin-team' },
  ], documents: [{ collectionId: 'things', documentId: 'demo', data: { title: 'synthetic' }, permissions: [] }] };
  const references = { records: [] };
  const result = await provision({ schema, seed, references });
  assert.equal(result.syntheticDocuments, 2);
  const postCount = calls.filter(call => call.method === 'POST').length;
  const second = await provision({ schema, seed, references });
  assert.equal(second.syntheticDocuments, 2);
  assert.equal(calls.filter(call => call.method === 'POST').length, postCount, JSON.stringify(calls.slice(postCount).filter(call => call.method === 'POST')));
  assert.equal(calls.some(call => call.path.includes('/functions')), false);
});

test('offline verification checks canonical contracts without contacting Appwrite', async () => {
  const result = await inspectOfflineSetup();
  assert.equal(result.collections, 13);
  assert.equal(result.municipalities, 78);
  assert.equal(result.remote, 'not checked');
});
