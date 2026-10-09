// Small client-only adapter for the synthetic hackathon collections.
// Permission/open-access controls are intentionally outside this browser code.
export function createMvpApi({ database, Query, ID, config, now = () => new Date() }) {
  const table = config.collections;
  const ref = (collectionId, documentId) => ({
    databaseId: config.databaseId, collectionId, documentId
  });
  const list = (collectionId, queries = []) => database.listDocuments({
    databaseId: config.databaseId,
    collectionId,
    queries: [...queries, Query.limit(100)]
  });
  const municipalityNames = { '72001': 'San Juan', '72076': 'Ponce', '72097': 'Mayagüez' };
  const municipalityIds = Object.fromEntries(Object.entries(municipalityNames).map(([id, name]) => [name, id]));
  const fieldEvent = (row) => ({
    state: row.eventType,
    time: row.occurredAt,
    note: row.responseNote || row.eventType
  });
  const upsert = async (collectionId, fieldValues, data) => {
    const result = await list(collectionId, Object.entries(fieldValues).map(([key, value]) => Query.equal(key, value)));
    const existing = result.documents?.[0];
    if (existing) return database.updateDocument({ ...ref(collectionId, existing.$id), data });
    return database.createDocument({ ...ref(collectionId, ID.unique()), permissions: [], data });
  };
  const createHistoryEvent = (facilityId, provider) => database.createDocument({
    ...ref(table.facilityStatusHistory, ID.unique()), permissions: [], data: {
      facilityId,
      operationalState: provider.state,
      electricityState: provider.electricity,
      generatorState: provider.generator,
      source: 'FacilityConfirmed',
      reportedAt: now().toISOString(),
      ...(provider.note ? { note: provider.note } : {}),
      ...(provider.interruptionStart ? { interruptionStart: new Date(provider.interruptionStart).toISOString() } : {}),
      ...(provider.interruptionEnd ? { interruptionEnd: new Date(provider.interruptionEnd).toISOString() } : {})
    }
  });

  return {
    async loadDemoData() {
      const [facilities, services, statuses, resources, confirmations, histories, requests, events] = await Promise.all([
        list(table.facilities), list(table.facilityServices), list(table.facilityOperationalStatus),
        list(table.resourceAvailability), list(table.facilityConfirmations), list(table.facilityStatusHistory),
        list(table.assistanceRequests), list(table.assistanceRequestEvents)
      ]);
      const byFacility = (rows, id) => rows.documents?.find(row => row.facilityId === id);
      const providers = (facilities.documents || []).map(facility => {
        const status = byFacility(statuses, facility.$id), service = byFacility(services, facility.$id);
        const resource = byFacility(resources, facility.$id), confirmation = byFacility(confirmations, facility.$id);
        return {
          id: facility.$id,
          name: facility.name,
          providerType: facility.providerType || 'organization',
          municipality: municipalityNames[facility.municipalityId] || `Municipio ${facility.municipalityId}`,
          address: facility.address || '', phone: facility.phone || '', hours: facility.hours || '',
          state: status?.operationalState || 'unknown', electricity: status?.electricityState || 'unknown',
          generator: status?.generatorState || 'unknown', note: status?.note || '',
          interruptionStart: status?.interruptionStart || '', interruptionEnd: status?.interruptionEnd || '',
          source: confirmation?.source || 'FacilityConfirmed', confirmedAt: confirmation?.confirmedAt || null,
          serviceAvailability: service?.availability || 'unknown', serviceNote: service?.note || '',
          resourceAvailability: resource?.availability || 'unknown', resourceNote: resource?.note || ''
        };
      });
      const requestsList = (requests.documents || []).map(request => ({
        id: request.$id, facilityId: request.facilityId, description: request.description,
        status: request.status, createdAt: request.$createdAt,
        events: (events.documents || []).filter(event => event.requestId === request.$id)
          .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))).map(fieldEvent)
      }));
      return {
        providers,
        requests: requestsList,
        history: (histories.documents || []).map(event => ({
          facilityId: event.facilityId, time: event.reportedAt,
          title: 'Estado operativo confirmado',
          note: `${event.operationalState} · Fuente: ${event.source}`
        })).sort((a, b) => String(b.time).localeCompare(String(a.time)))
      };
    },

    async saveProvider(provider, section) {
      if (section === 'perfil') {
        const data = {
          name: provider.name,
          municipalityId: municipalityIds[provider.municipality] || provider.municipality,
          providerType: provider.providerType
        };
        // Optional attributes must be sent when cleared so old values do not survive a save.
        for (const key of ['phone', 'address', 'hours']) data[key] = provider[key] || null;
        return database.updateDocument({ ...ref(table.facilities, provider.id), data });
      }
      if (section === 'operacion') {
        const occurredAt = now();
        const status = {
          facilityId: provider.id,
          operationalState: provider.state,
          electricityState: provider.electricity,
          generatorState: provider.generator,
          note: provider.note || '',
          ...(provider.interruptionStart ? { interruptionStart: new Date(provider.interruptionStart).toISOString() } : {}),
          ...(provider.interruptionEnd ? { interruptionEnd: new Date(provider.interruptionEnd).toISOString() } : {})
        };
        // State, history and confirmation are separate Appwrite writes in demo mode.
        await upsert(table.facilityOperationalStatus, { facilityId: provider.id }, status);
        await database.createDocument({
          ...ref(table.facilityStatusHistory, ID.unique()), permissions: [],
          data: { ...status, source: 'FacilityConfirmed', reportedAt: occurredAt.toISOString() }
        });
        const expiresAt = new Date(occurredAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
        return upsert(table.facilityConfirmations, { facilityId: provider.id }, {
          facilityId: provider.id, source: 'FacilityConfirmed',
          confirmedAt: occurredAt.toISOString(), validUntil: expiresAt, note: provider.note || ''
        });
      }
      if (section === 'servicios') {
        return upsert(table.facilityServices, { facilityId: provider.id, serviceId: 'pharmacy' }, {
          facilityId: provider.id, serviceId: 'pharmacy', availability: provider.serviceAvailability,
          note: provider.serviceNote || ''
        });
      }
      if (section === 'recursos') {
        return upsert(table.resourceAvailability, { facilityId: provider.id, resourceType: 'demo-medicines' }, {
          facilityId: provider.id, resourceType: 'demo-medicines', availability: provider.resourceAvailability,
          note: provider.resourceNote || ''
        });
      }
      throw new Error('UNSUPPORTED_PROVIDER_SECTION');
    },

    async respondToRequest(requestId, status, responseNote) {
      const request = await database.updateDocument({
        ...ref(table.assistanceRequests, requestId), data: { status }
      });
      await database.createDocument({
        ...ref(table.assistanceRequestEvents, ID.unique()), permissions: [], data: {
          requestId, eventType: status, actorId: 'demo-provider', occurredAt: now().toISOString(), responseNote
        }
      });
      return request;
    }
  };
}
