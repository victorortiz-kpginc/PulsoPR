import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('./schema/pulso-pr.schema.json', import.meta.url), 'utf8'));
const entities = [
  'CitizenProfiles', 'Municipalities', 'Facilities', 'HealthcareServices',
  'FacilityServices', 'FacilityOperationalStatus', 'FacilityStatusHistory',
  'ResourceAvailability', 'AssistanceRequests', 'AssistanceRequestEvents',
  'FacilityConfirmations', 'OperationalAuditEvents',
];
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

test('one final database has one stable collection per required entity', () => {
  assert.equal(schema.database.id, 'pulso-pr');
  assert.equal(schema.database.name, 'Pulso PR');
  assert.equal(schema.database.apiFamily, 'Databases');
  assert.equal(schema.database.collectionsPerFacility, false);
  assert.deepEqual(new Set(schema.collections.map(c => c.name)), new Set(entities));
  assert.equal(new Set(schema.collections.map(c => c.id)).size, entities.length);
  for (const c of schema.collections) {
    assert.ok(id.test(c.id));
    assert.ok(!c.id.startsWith('s01-'));
  }
});

test('all physical indexes reference declared attributes with matching orders', () => {
  for (const c of schema.collections) {
    const keys = new Set(c.attributes.map(a => a.key));
    assert.equal(keys.size, c.attributes.length);
    assert.equal(new Set(c.indexes.map(i => i.key)).size, c.indexes.length);
    for (const i of c.indexes) {
      assert.ok(id.test(i.key));
      assert.equal(i.attributes.length, i.orders.length);
      for (const attr of i.attributes) assert.ok(keys.has(attr), `${c.id}/${i.key}/${attr}`);
      for (const order of i.orders) assert.ok(['ASC', 'DESC'].includes(order));
    }
    for (const ref of Object.keys(c.references)) assert.ok(keys.has(ref));
  }
});

test('attributes explicitly define native types, limits and obligation without duplicating native metadata', () => {
  for (const c of schema.collections) for (const a of c.attributes) {
    assert.equal(typeof a.required, 'boolean');
    assert.ok(!a.key.startsWith('$'));
    assert.ok(['string', 'enum', 'datetime', 'boolean', 'double'].includes(a.type));
    if (a.type === 'string') assert.ok(a.size > 0 && a.size <= 500);
    if (a.type === 'enum') assert.ok(a.elements.length && new Set(a.elements).size === a.elements.length);
    if (a.type === 'double') assert.ok(a.min < a.max);
  }
});

test('hackathon domain permits public CRUD while reference data remains read-only', () => {
  assert.equal(schema.accessMode, 'hackathon-open-synthetic');
  for (const c of schema.collections) {
    assert.equal(c.documentSecurity, true);
    if (['municipalities', 'healthcare_services'].includes(c.id)) assert.deepEqual(c.permissions, ['read("any")']);
    else {
      assert.equal(c.clientWrites, 'enabled_synthetic_hackathon_only');
      assert.deepEqual(c.permissions, ['read("any")', 'create("any")', 'update("any")', 'delete("any")']);
    }
    assert.ok(!c.attributes.some(a => ['email', 'password', 'session'].includes(a.key)));
  }
  for (const b of schema.buckets) assert.equal(b.fileSecurity, true);
});

test('references target known collections or native Appwrite services', () => {
  const ids = new Set(schema.collections.map(c => c.id));
  for (const c of schema.collections) for (const ref of Object.values(c.references)) {
    assert.ok(ref.startsWith('Appwrite ') || ref.startsWith('Target ') || ids.has(ref.split('.')[0]), ref);
  }
});
