import test from 'node:test';
import assert from 'node:assert/strict';
import { createMvpApi } from '../wwwroot/js/appwrite-api-core.js';

const config = {
  databaseId: 'pulso-pr',
  collections: {
    facilities: 'facilities', facilityServices: 'facility_services',
    facilityOperationalStatus: 'facility_operational_status', resourceAvailability: 'resource_availability',
    facilityConfirmations: 'facility_confirmations', facilityStatusHistory: 'facility_status_history',
    assistanceRequests: 'assistance_requests', assistanceRequestEvents: 'assistance_request_events'
  }
};

function fixture() {
  const data = new Map(Object.entries({
    facilities: [{ $id: 'hackathon-demo-pharmacy', name: 'Farmacia Demo Pulso PR — FICTICIA', municipalityId: '72001', providerType: 'organization' }],
    facility_services: [{ $id: 'service-1', facilityId: 'hackathon-demo-pharmacy', serviceId: 'pharmacy', availability: 'available', note: 'Demo' }],
    facility_operational_status: [{ $id: 'hackathon-demo-pharmacy', facilityId: 'hackathon-demo-pharmacy', operationalState: 'operational', electricityState: 'available', generatorState: 'available', note: 'Demo' }],
    resource_availability: [{ $id: 'resource-1', facilityId: 'hackathon-demo-pharmacy', resourceType: 'demo-medicines', availability: 'limited', note: 'Demo' }],
    facility_confirmations: [{ $id: 'confirm-1', facilityId: 'hackathon-demo-pharmacy', source: 'FacilityConfirmed', confirmedAt: '2026-10-09T12:00:00.000Z' }],
    facility_status_history: [],
    assistance_requests: [{ $id: 'request-1', $createdAt: '2026-10-09T12:00:00.000Z', facilityId: 'hackathon-demo-pharmacy', description: 'Consulta sintética', status: 'submitted' }],
    assistance_request_events: [{ $id: 'event-1', requestId: 'request-1', eventType: 'submitted', occurredAt: '2026-10-09T12:00:00.000Z', responseNote: 'Solicitud de demo' }]
  }));
  const writes = [];
  const db = {
    async listDocuments({ collectionId, queries }) {
      let documents = data.get(collectionId) || [];
      for (const query of queries.filter(q => q.method === 'equal')) documents = documents.filter(row => row[query.attribute] === query.value);
      return { documents: structuredClone(documents), total: documents.length };
    },
    async updateDocument({ collectionId, documentId, data: patch }) {
      const rows = data.get(collectionId) || [];
      const old = rows.find(row => row.$id === documentId);
      assert.ok(old, `expected ${collectionId}/${documentId} to exist`);
      Object.assign(old, structuredClone(patch));
      writes.push({ kind: 'update', collectionId, documentId, data: structuredClone(patch) });
      return structuredClone(old);
    },
    async createDocument({ collectionId, documentId, permissions, data: doc }) {
      const row = { $id: documentId, ...structuredClone(doc) };
      data.get(collectionId).push(row);
      writes.push({ kind: 'create', collectionId, documentId, permissions, data: structuredClone(doc) });
      return structuredClone(row);
    }
  };
  let nextId = 0;
  const Query = { limit: value => ({ method: 'limit', value }), equal: (attribute, value) => ({ method: 'equal', attribute, value }) };
  const ID = { unique: () => `generated-${++nextId}` };
  return { api: createMvpApi({ database: db, Query, ID, config, now: () => new Date('2026-10-09T14:00:00.000Z') }), data, writes };
}

test('read model combines synthetic facilities, operational data, requests and events', async () => {
  const { api } = fixture();
  const result = await api.loadDemoData();
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].id, 'hackathon-demo-pharmacy');
  assert.equal(result.providers[0].municipality, 'San Juan');
  assert.equal(result.providers[0].state, 'operational');
  assert.equal(result.providers[0].resourceAvailability, 'limited');
  assert.equal(result.requests[0].events[0].note, 'Solicitud de demo');
});

test('operational confirmation upserts current state and confirmation, then creates history', async () => {
  const { api, data, writes } = fixture();
  await api.saveProvider({ id: 'hackathon-demo-pharmacy', state: 'limited', electricity: 'unavailable', generator: 'available', note: 'Interrupción ficticia' }, 'operacion');
  assert.equal(data.get('facility_operational_status')[0].operationalState, 'limited');
  assert.equal(data.get('facility_confirmations')[0].validUntil, '2026-10-10T14:00:00.000Z');
  assert.equal(data.get('facility_status_history').length, 1);
  assert.deepEqual(writes.map(write => write.kind), ['update', 'create', 'update']);
});

test('provider response writes status and event separately with synthetic actor', async () => {
  const { api, data, writes } = fixture();
  await api.respondToRequest('request-1', 'acknowledged', 'Recibida para coordinar');
  assert.equal(data.get('assistance_requests')[0].status, 'acknowledged');
  const event = data.get('assistance_request_events')[1];
  assert.deepEqual({ type: event.eventType, actor: event.actorId, note: event.responseNote }, {
    type: 'acknowledged', actor: 'demo-provider', note: 'Recibida para coordinar'
  });
  assert.deepEqual(writes.map(write => write.kind), ['update', 'create']);
  assert.deepEqual(writes[1].permissions, []);
});

test('profile, service and resource changes update only their own synthetic documents', async () => {
  const { api, data, writes } = fixture();
  await api.saveProvider({ id:'hackathon-demo-pharmacy', name:'Farmacia de la demo', municipality:'Ponce', providerType:'organization', address:'Dirección ficticia' }, 'perfil');
  await api.saveProvider({ id:'hackathon-demo-pharmacy', serviceAvailability:'limited', serviceNote:'Coordinar en el demo' }, 'servicios');
  await api.saveProvider({ id:'hackathon-demo-pharmacy', resourceAvailability:'available', resourceNote:'Existencia ficticia' }, 'recursos');
  assert.equal(data.get('facilities')[0].name, 'Farmacia de la demo');
  assert.equal(data.get('facilities')[0].municipalityId, '72076');
  assert.equal(data.get('facility_services')[0].availability, 'limited');
  assert.equal(data.get('resource_availability')[0].availability, 'available');
  assert.deepEqual(writes.map(write => write.collectionId), ['facilities','facility_services','resource_availability']);
});

test('clearing optional profile fields removes their previous persisted values', async () => {
  const { api, data } = fixture();
  Object.assign(data.get('facilities')[0], { phone:'Contacto ficticio', address:'Dirección ficticia', hours:'09:00–17:00' });
  await api.saveProvider({ id:'hackathon-demo-pharmacy', name:'Farmacia ficticia', municipality:'San Juan', providerType:'organization', phone:'', address:'', hours:'' }, 'perfil');
  for (const key of ['phone', 'address', 'hours']) assert.equal(data.get('facilities')[0][key], null);
});
