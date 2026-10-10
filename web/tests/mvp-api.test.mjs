import test from 'node:test';
import assert from 'node:assert/strict';
import { createMvpApi, resolvePortalRole } from '../wwwroot/js/appwrite-api-core.js';

const config = {
  databaseId: 'pulso-pr',
  collections: {
    municipalities: 'municipalities', incidents: 'incidents',
    facilities: 'facilities', facilityServices: 'facility_services',
    facilityOperationalStatus: 'facility_operational_status', resourceAvailability: 'resource_availability',
    facilityConfirmations: 'facility_confirmations', facilityStatusHistory: 'facility_status_history',
    assistanceRequests: 'assistance_requests', assistanceRequestEvents: 'assistance_request_events'
  }
};

function fixture() {
  const data = new Map(Object.entries({
    facilities: [{ $id: 'hackathon-demo-pharmacy', name: 'Farmacia Demo Pulso PR — FICTICIA', municipalityId: '72001', providerType: 'organization', teamId: 'hackathon-demo-team', latitude: 18.1628, longitude: -66.7221 }],
    municipalities: [{ $id: 'town-adjuntas', code: '72001', name: 'Adjuntas' }],
    incidents: [
      { $id:'incident-active', title:'Incidente activo', incidentType:'Coordinación', municipalityId:'72001', latitude:18.1661, longitude:-66.7185, radiusMeters:700, status:'active', validFrom:new Date(Date.now()-60_000).toISOString(), validUntil:new Date(Date.now()+60_000).toISOString(), description:'Vigente' },
      { $id:'incident-expired', title:'Incidente vencido', incidentType:'Coordinación', municipalityId:'72001', latitude:18.1630, longitude:-66.7220, radiusMeters:300, status:'active', validFrom:new Date(Date.now()-172_800_000).toISOString(), validUntil:new Date(Date.now()-86_400_000).toISOString(), description:'Vencido' }
    ],
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
      for (const query of queries) {
        if (query.method === 'equal') documents = documents.filter(row => row[query.attribute] === query.value);
        if (query.method === 'between') documents = documents.filter(row => row[query.attribute] >= query.values[0] && row[query.attribute] <= query.values[1]);
        if (query.method === 'offset') documents = documents.slice(query.value);
        if (query.method === 'limit') documents = documents.slice(0, query.value);
      }
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
  const Query = { limit: value => ({ method: 'limit', value }), offset: value => ({ method: 'offset', value }), equal: (attribute, value) => ({ method: 'equal', attribute, value }), between: (attribute, min, max) => ({ method: 'between', attribute, values:[min,max] }) };
  const ID = { unique: () => `generated-${++nextId}` };
  return { api: createMvpApi({ database: db, Query, ID, config, now: () => new Date('2026-10-09T14:00:00.000Z') }), data, writes };
}

test('portal role requires one confirmed membership matching the current user', () => {
  assert.deepEqual(resolvePortalRole('provider-user', [{ userId:'provider-user', teamId:'hackathon-demo-team', confirm:true, roles:['provider'] }], []), { role:'provider', teamId:'hackathon-demo-team' });
  assert.equal(resolvePortalRole('outsider', [{ userId:'provider-user', confirm:true, roles:['provider'] }], []), null);
  assert.equal(resolvePortalRole('pending', [{ userId:'pending', confirm:false, roles:['provider'] }], []), null);
  assert.equal(resolvePortalRole('ambiguous', [{ userId:'ambiguous', confirm:true, roles:['provider'] }], [{ userId:'ambiguous', confirm:true, roles:['admin'] }]), null);
});

test('read model combines synthetic facilities, operational data, requests and events', async () => {
  const { api } = fixture();
  const result = await api.loadDemoData();
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].id, 'hackathon-demo-pharmacy');
  assert.equal(result.providers[0].municipality, 'Adjuntas');
  assert.equal(result.providers[0].state, 'operational');
  assert.equal(result.providers[0].resourceAvailability, 'limited');
  assert.equal(result.requests[0].events[0].note, 'Solicitud de demo');
});

test('geographic lookup keeps nearby active items, filters expired and outside-radius records', async () => {
  const { api, data } = fixture();
  data.get('facilities').push({ $id:'outside', name:'Ubicación distante', municipalityId:'72001', providerType:'organization', latitude:18.25, longitude:-66.72 });
  data.get('facilities').push({ $id:'no-coordinates', name:'Sin coordenadas', municipalityId:'72001', providerType:'organization', latitude:null, longitude:null });
  const places = await api.loadGeographicMap({ municipalityId:'72001', radiusKm:1, latitude:18.1628, longitude:-66.7221, providerType:'all' });
  assert.deepEqual(places.places.map(place => place.id), ['hackathon-demo-pharmacy','incident-active']);
  assert.equal(places.municipalities[0].name, 'Adjuntas');
  assert.ok(places.places[1].distanceKm < 1);
});

test('provider read model is limited to its assigned Team facility', async () => {
  const { api, data } = fixture();
  data.get('facilities').push({ $id:'other-center', name:'Otro centro', municipalityId:'72001', providerType:'organization', teamId:'other-team' });
  const result = await api.loadDemoData({ role:'provider', teamId:'hackathon-demo-team' });
  assert.deepEqual(result.providers.map(row => row.id), ['hackathon-demo-pharmacy']);
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
  await api.respondToRequest('request-1', 'acknowledged', 'Recibida para coordinar', 'pulso-demo-provider');
  assert.equal(data.get('assistance_requests')[0].status, 'acknowledged');
  const event = data.get('assistance_request_events')[1];
  assert.deepEqual({ type: event.eventType, actor: event.actorId, note: event.responseNote }, {
    type: 'acknowledged', actor: 'pulso-demo-provider', note: 'Recibida para coordinar'
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
  assert.equal(data.get('facilities')[0].municipalityId, '72113');
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
