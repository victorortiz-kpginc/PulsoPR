// Small client-only adapter for the synthetic hackathon collections.
// Permission/open-access controls are intentionally outside this browser code.
export function resolvePortalRole(userId, providerMemberships = [], adminMemberships = []) {
  const candidates = [];
  for (const membership of providerMemberships) {
    if (membership.userId === userId && membership.confirm === true && membership.roles?.includes('provider')) candidates.push({ role:'provider', teamId:membership.teamId || 'hackathon-demo-team' });
  }
  for (const membership of adminMemberships) {
    if (membership.userId === userId && membership.confirm === true && membership.roles?.includes('admin')) candidates.push({ role:'admin', teamId:membership.teamId || 'pulso-pr-admins' });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

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
  const municipalityNames = { '72001': 'Adjuntas', '72127': 'San Juan', '72113': 'Ponce', '72097': 'Mayagüez' };
  const municipalityIds = Object.fromEntries(Object.entries(municipalityNames).map(([id, name]) => [name, id]));
  let canonicalMunicipalityIds = {};
  const allPages = async (collectionId, filters = []) => {
    const rows = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const page = await database.listDocuments({ databaseId: config.databaseId, collectionId, queries: [...filters, Query.limit(100), Query.offset(offset)] });
      rows.push(...(page.documents || []));
      if (rows.length >= page.total || page.documents.length < 100) break;
    }
    return rows;
  };
  const haversine = (a, b) => {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const geoBox = (center, km) => {
    const dLat = km / 110.574, dLon = km / (111.32 * Math.max(0.01, Math.cos(center[0] * Math.PI / 180)));
    return { minLat: Math.max(-90, center[0] - dLat), maxLat: Math.min(90, center[0] + dLat), minLon: Math.max(-180, center[1] - dLon), maxLon: Math.min(180, center[1] + dLon) };
  };
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
    async loadGeographicMap(options) {
      const townsPromise = allPages(table.municipalities).then(rows => rows.filter(row => row.code && row.name).map(row => ({ code: row.code, name: row.name })).sort((a, b) => a.name.localeCompare(b.name, 'es')));
      const assignedFacility = options.role === 'provider' && options.teamId
        ? (await allPages(table.facilities, [Query.equal('teamId', options.teamId)]))[0]
        : null;
      if (options.role === 'provider' && !assignedFacility) throw new Error('PROVIDER_FACILITY_NOT_ASSIGNED');
      const municipalityId = assignedFacility?.municipalityId || options.municipalityId;
      const municipalityOptions = await townsPromise;
      const visibleMunicipalities = options.role === 'provider' && assignedFacility
        ? municipalityOptions.filter(row => row.code === assignedFacility.municipalityId)
        : municipalityOptions;
      const center = Number.isFinite(options.latitude) && Number.isFinite(options.longitude) ? [options.latitude, options.longitude] : null;
      const box = center ? geoBox(center, Number(options.radiusKm) || 5) : null;
      const facilityFilters = [
        ...(municipalityId ? [Query.equal('municipalityId', municipalityId)] : []),
        ...(options.providerType && options.providerType !== 'all' ? [Query.equal('providerType', options.providerType)] : []),
        ...(box ? [Query.between('latitude', box.minLat, box.maxLat), Query.between('longitude', box.minLon, box.maxLon)] : [])
      ];
      const incidentFilters = [
        ...(municipalityId ? [Query.equal('municipalityId', municipalityId)] : []),
        Query.equal('status', 'active'),
        ...(box ? [Query.between('latitude', box.minLat, box.maxLat), Query.between('longitude', box.minLon, box.maxLon)] : [])
      ];
      let facilities, incidents;
      try {
        [facilities, incidents] = await Promise.all([allPages(table.facilities, facilityFilters), allPages(table.incidents, incidentFilters)]);
      } catch (error) {
        if (!box) throw error;
        [facilities, incidents] = await Promise.all([
          allPages(table.facilities, [...(municipalityId ? [Query.equal('municipalityId', municipalityId)] : []), ...(options.providerType && options.providerType !== 'all' ? [Query.equal('providerType', options.providerType)] : [])]),
          allPages(table.incidents, [...(municipalityId ? [Query.equal('municipalityId', municipalityId)] : []), Query.equal('status', 'active')])
        ]);
      }
      const municipalities = visibleMunicipalities;
      const townNames = Object.fromEntries(municipalities.map(row => [row.code, row.name]));
      const now = Date.now(), maxDistance = (Number(options.radiusKm) || 5);
      const providers = facilities.filter(row => options.role !== 'provider' || row.teamId === options.teamId).flatMap(row => {
        // Number(null) is 0, so require stored numeric coordinates before mapping.
        const latitude = typeof row.latitude === 'number' ? row.latitude : Number.NaN;
        const longitude = typeof row.longitude === 'number' ? row.longitude : Number.NaN;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        const distance = center ? haversine(center, [latitude, longitude]) : null;
        if (distance !== null && distance > maxDistance) return [];
        const providerType = row.providerType || 'organization';
        return [{ id: row.$id, kind: 'provider', name: row.name || 'Proveedor', type: providerType === 'person' ? 'Persona' : providerType === 'community_center' ? 'Centro comunitario' : 'Organización', municipality: townNames[row.municipalityId] || 'Puerto Rico', municipalityId: row.municipalityId || '', latitude, longitude, detail: row.address || 'Ubicación registrada', distanceKm: distance }];
      });
      const activeIncidents = incidents.flatMap(row => {
        const start = Date.parse(row.validFrom || ''), end = Date.parse(row.validUntil || '');
        if (row.status !== 'active' || !Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now) return [];
        const latitude = Number(row.latitude), longitude = Number(row.longitude), radiusMeters = Number(row.radiusMeters);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusMeters)) return [];
        const distance = center ? haversine(center, [latitude, longitude]) : null;
        if (distance !== null && distance * 1000 > maxDistance * 1000 + radiusMeters) return [];
        return [{ id: row.$id, kind: 'incident', name: row.title || row.incidentType || 'Incidente', type: row.incidentType || 'Incidente comunitario', municipality: townNames[row.municipalityId] || 'Puerto Rico', municipalityId: row.municipalityId || '', latitude, longitude, radiusMeters, detail: row.description || 'Información comunitaria', distanceKm: distance }];
      });
      return { municipalities, places: [...providers, ...activeIncidents].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)) };
    },
    async loadDemoData(session) {
      const [facilities, services, statuses, resources, confirmations, histories, requests, events, towns] = await Promise.all([
        list(table.facilities), list(table.facilityServices), list(table.facilityOperationalStatus),
        list(table.resourceAvailability), list(table.facilityConfirmations), list(table.facilityStatusHistory),
        list(table.assistanceRequests), list(table.assistanceRequestEvents), list(table.municipalities)
      ]);
      const townNames = Object.fromEntries((towns.documents || []).filter(row => row.code && row.name).map(row => [row.code,row.name]));
      const townIds = Object.fromEntries((towns.documents || []).filter(row => row.code && row.name).map(row => [row.name,row.code]));
      canonicalMunicipalityIds = townIds;
      const permittedFacilities = (facilities.documents || []).filter(facility => session?.role !== 'provider' || facility.teamId === session.teamId);
      const permittedFacilityIds = new Set(permittedFacilities.map(facility => facility.$id));
      const permittedRequests = (requests.documents || []).filter(request => session?.role !== 'provider' || permittedFacilityIds.has(request.facilityId));
      const byFacility = (rows, id) => rows.documents?.find(row => row.facilityId === id);
      const providers = permittedFacilities.map(facility => {
        const status = byFacility(statuses, facility.$id), service = byFacility(services, facility.$id);
        const resource = byFacility(resources, facility.$id), confirmation = byFacility(confirmations, facility.$id);
        return {
          id: facility.$id,
          name: facility.name,
          providerType: facility.providerType || 'organization',
          municipality: townNames[facility.municipalityId] || `Municipio ${facility.municipalityId}`,
          address: facility.address || '', phone: facility.phone || '', hours: facility.hours || '',
          state: status?.operationalState || 'unknown', electricity: status?.electricityState || 'unknown',
          generator: status?.generatorState || 'unknown', note: status?.note || '',
          interruptionStart: status?.interruptionStart || '', interruptionEnd: status?.interruptionEnd || '',
          source: confirmation?.source || 'FacilityConfirmed', confirmedAt: confirmation?.confirmedAt || null,
          serviceAvailability: service?.availability || 'unknown', serviceNote: service?.note || '',
          resourceAvailability: resource?.availability || 'unknown', resourceNote: resource?.note || ''
        };
      });
      const requestsList = permittedRequests.map(request => ({
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

    async createProvider(provider) {
      const data = {
        name: provider.name.trim(),
        municipalityId: canonicalMunicipalityIds[provider.municipality] || municipalityIds[provider.municipality] || provider.municipality,
        providerType: provider.providerType || 'organization',
        phone: provider.phone || null,
        address: provider.address || null,
        hours: provider.hours || null,
        teamId: null
      };
      const created = await database.createDocument({
        ...ref(table.facilities, ID.unique()), permissions: [], data
      });
      return { ...provider, id: created.$id, state: 'unknown', confirmedAt: null, source: 'FacilityConfirmed' };
    },

    async saveProvider(provider, section) {
      if (section === 'perfil') {
        const data = {
          name: provider.name,
          municipalityId: canonicalMunicipalityIds[provider.municipality] || municipalityIds[provider.municipality] || provider.municipality,
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

    async respondToRequest(requestId, status, responseNote, actorId) {
      const request = await database.updateDocument({
        ...ref(table.assistanceRequests, requestId), data: { status }
      });
      await database.createDocument({
        ...ref(table.assistanceRequestEvents, ID.unique()), permissions: [], data: {
          requestId, eventType: status, actorId, occurredAt: now().toISOString(), responseNote
        }
      });
      return request;
    }
  };
}
