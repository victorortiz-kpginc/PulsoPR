import { Client, Databases, Query } from 'appwrite';
import { demoConfig } from '../domain/config';
import type { AssistanceRequest, Confirmation, Facility, RequestEvent, RequestStatus } from '../domain/contracts';
import type { PreviewProvider, ProviderKind } from '../preview/fixtures';
import { municipalityOptions } from '../preview/municipalities';

const client = new Client().setEndpoint(demoConfig.endpoint).setProject(demoConfig.projectId);
const db = new Databases(client);
const databaseId = demoConfig.databaseId;
const serviceLabels: Record<string, string> = { pharmacy: 'Medicamentos' };
const colors: Record<ProviderKind, string> = { person: 'peach', organization: 'teal', community_center: 'lavender' };
type Row = Record<string, unknown> & { $id: string };
const collection = (collectionId: string, documentId: string) => ({ databaseId, collectionId, documentId });
const queryRows = (collectionId: string, queries: string[]) => db.listDocuments({ databaseId, collectionId, queries });

function providerType(row: Row): ProviderKind {
  const value = row.providerType;
  return value === 'person' || value === 'community_center' ? value : 'organization';
}

function previewFacility(row: Row, offeredService?: Row): PreviewProvider {
  const facility = row as unknown as Facility;
  const kind = providerType(row);
  const initials = facility.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const serviceId = offeredService?.serviceId;
  return {
    facility: { ...facility, providerType: kind }, kind,
    service: typeof serviceId === 'string' ? serviceLabels[serviceId] ?? serviceId : 'Servicios por confirmar',
    summary: typeof offeredService?.note === 'string' ? offeredService.note : typeof serviceId === 'string' ? 'Apoyo comunitario e información de servicios.' : 'El proveedor aún no ha añadido servicios.',
    initials, color: colors[kind], operational: 'Sin información operativa',
    resources: 'Sin información reciente', electricity: 'Sin información', generator: 'Sin información',
  };
}

function asConfirmation(value?: Row): Confirmation | undefined {
  if (!value || typeof value.source !== 'string' || typeof value.confirmedAt !== 'string' || typeof value.validUntil !== 'string') return undefined;
  if (!['FacilityConfirmed', 'CoordinatorConfirmed', 'CommunityReported'].includes(value.source)) return undefined;
  return { source: value.source as Confirmation['source'], confirmedAt: value.confirmedAt, validUntil: value.validUntil };
}

export function municipalityCode(name: string): string {
  return municipalityOptions.find(row => row.name === name)?.code ?? municipalityOptions[0].code;
}

export function municipalityName(code: string): string {
  return municipalityOptions.find(row => row.code === code)?.name ?? 'Puerto Rico';
}

export async function listMunicipalityOptions(): Promise<{ code: string; name: string }[]> {
  const result = await queryRows('municipalities', [Query.limit(100)]);
  return (result.documents as Row[]).flatMap(row => typeof row.code === 'string' && typeof row.name === 'string' ? [{ code: row.code, name: row.name }] : []).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function listProviders(options: { municipalityId?: string; providerType?: ProviderKind } = {}): Promise<PreviewProvider[]> {
  const queries = [Query.limit(100)];
  if (options.municipalityId) queries.push(Query.equal('municipalityId', options.municipalityId));
  if (options.providerType) queries.push(Query.equal('providerType', options.providerType));
  const [result, services] = await Promise.all([queryRows('facilities', queries), queryRows('facility_services', [Query.limit(100)])]);
  const serviceByFacility = new Map((services.documents as Row[]).map(row => [String(row.facilityId), row]));
  return (result.documents as Row[]).map(row => previewFacility(row, serviceByFacility.get(row.$id)));
}

export interface GeographicPlace {
  id: string; kind: 'provider' | 'incident'; name: string; type: string; municipality: string;
  municipalityId: string; latitude: number; longitude: number; radiusMeters?: number;
  detail: string; distanceKm: number | null;
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function listAllPages(collectionId: string, filters: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await db.listDocuments({ databaseId, collectionId, queries: [...filters, Query.limit(100), Query.offset(offset)] });
    rows.push(...result.documents as Row[]);
    if (rows.length >= result.total || result.documents.length < 100) break;
  }
  return rows;
}

function boundingBox(center: [number, number], radiusKm: number) {
  const latDelta = radiusKm / 110.574;
  const lonDelta = radiusKm / (111.320 * Math.max(0.01, Math.cos(center[0] * Math.PI / 180)));
  return { minLat: Math.max(-90, center[0] - latDelta), maxLat: Math.min(90, center[0] + latDelta), minLon: Math.max(-180, center[1] - lonDelta), maxLon: Math.min(180, center[1] + lonDelta) };
}

export async function listGeographicPlaces(options: { municipalityId?: string; center?: [number, number]; radiusKm: number; providerType?: ProviderKind }): Promise<GeographicPlace[]> {
  const box = options.center ? boundingBox(options.center, options.radiusKm) : undefined;
  const facilityFilters = [...(options.municipalityId ? [Query.equal('municipalityId', options.municipalityId)] : []), ...(options.providerType ? [Query.equal('providerType', options.providerType)] : []),
    ...(box ? [Query.between('latitude', box.minLat, box.maxLat), Query.between('longitude', box.minLon, box.maxLon)] : [])];
  const incidentFilters = [...(options.municipalityId ? [Query.equal('municipalityId', options.municipalityId)] : []), Query.equal('status', 'active'),
    ...(box ? [Query.between('latitude', box.minLat, box.maxLat), Query.between('longitude', box.minLon, box.maxLon)] : [])];
  let facilities: Row[], incidents: Row[];
  try {
    [facilities, incidents] = await Promise.all([listAllPages('facilities', facilityFilters), listAllPages('incidents', incidentFilters)]);
  } catch (error) {
    // DocumentsDB has scalar latitude/longitude; if this server rejects the paired range query,
    // page by the selected municipality and keep exact filtering local.
    if (!box) throw error;
    [facilities, incidents] = await Promise.all([
      listAllPages('facilities', [...(options.municipalityId ? [Query.equal('municipalityId', options.municipalityId)] : []), ...(options.providerType ? [Query.equal('providerType', options.providerType)] : [])]),
      listAllPages('incidents', [...(options.municipalityId ? [Query.equal('municipalityId', options.municipalityId)] : []), Query.equal('status', 'active')])
    ]);
  }
  const now = Date.now();
  const providers = facilities.flatMap(row => {
    // Number(null) is 0, which creates a false marker at Null Island for
    // Facilities whose optional coordinates have not been set.
    const latitude = typeof row.latitude === 'number' ? row.latitude : Number.NaN;
    const longitude = typeof row.longitude === 'number' ? row.longitude : Number.NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const distance = options.center ? distanceKm(options.center, [latitude, longitude]) : null;
    if (distance !== null && distance > options.radiusKm) return [];
    return [{ id: row.$id, kind: 'provider' as const, name: String(row.name ?? 'Proveedor'), type: providerType(row) === 'person' ? 'Persona' : providerType(row) === 'community_center' ? 'Centro comunitario' : 'Organización', municipality: municipalityName(String(row.municipalityId ?? '')), municipalityId: String(row.municipalityId ?? ''), latitude, longitude, detail: String(row.address ?? 'Ubicación registrada'), distanceKm: distance ?? 0 }];
  });
  const activeIncidents = incidents.flatMap(row => {
    if (row.status !== 'active' || Date.parse(String(row.validFrom ?? '')) > now || Date.parse(String(row.validUntil ?? '')) <= now) return [];
    const latitude = Number(row.latitude), longitude = Number(row.longitude), radiusMeters = Number(row.radiusMeters);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusMeters)) return [];
    const distance = options.center ? distanceKm(options.center, [latitude, longitude]) : null;
    if (distance !== null && distance * 1000 > options.radiusKm * 1000 + radiusMeters) return [];
    return [{ id: row.$id, kind: 'incident' as const, name: String(row.title ?? row.incidentType ?? 'Incidente'), type: String(row.incidentType ?? 'Incidente comunitario'), municipality: municipalityName(String(row.municipalityId ?? '')), municipalityId: String(row.municipalityId ?? ''), latitude, longitude, radiusMeters, detail: String(row.description ?? 'Información comunitaria'), distanceKm: distance ?? 0 }];
  });
  return [...providers, ...activeIncidents].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export async function getProvider(facilityId: string): Promise<PreviewProvider> {
  const row = await db.getDocument(collection('facilities', facilityId)) as Row;
  const filter = [Query.equal('facilityId', facilityId), Query.limit(100)];
  const [services, statuses, resources, confirmations] = await Promise.all([
    queryRows('facility_services', filter), queryRows('facility_operational_status', filter),
    queryRows('resource_availability', filter), queryRows('facility_confirmations', filter),
  ]);
  const service = (services.documents as Row[])[0];
  const provider = previewFacility(row, service);
  const status = (statuses.documents as Row[])[0];
  const availability = (resources.documents as Row[])[0];
  const confirmation = asConfirmation((confirmations.documents as Row[])[0]);
  const operationalState = status?.operationalState;
  return {
    ...provider,
    service: provider.service,
    summary: provider.summary,
    operational: operationalState === 'operational' ? 'Operativo' : typeof operationalState === 'string' ? operationalState : provider.operational,
    resources: availability ? `${String(availability.resourceType ?? 'Recurso')}: ${String(availability.availability ?? 'sin información')}` : provider.resources,
    electricity: typeof status?.electricityState === 'string' ? status.electricityState : provider.electricity,
    generator: typeof status?.generatorState === 'string' ? status.generatorState : provider.generator,
    confirmation,
  };
}

export async function listCitizenRequests(citizenId: string): Promise<AssistanceRequest[]> {
  const result = await queryRows('assistance_requests', [Query.equal('citizenId', citizenId), Query.orderDesc('$createdAt'), Query.limit(100)]);
  return result.documents as unknown as AssistanceRequest[];
}

export async function getCitizenRequest(requestId: string, citizenId: string): Promise<{ request: AssistanceRequest; events: RequestEvent[] }> {
  const request = await db.getDocument(collection('assistance_requests', requestId)) as unknown as AssistanceRequest;
  if (request.citizenId !== citizenId) throw new Error('REQUEST_NOT_OWNED_BY_CURRENT_USER');
  const events = await queryRows('assistance_request_events', [Query.equal('requestId', requestId), Query.orderAsc('occurredAt'), Query.limit(100)]);
  return { request, events: events.documents as unknown as RequestEvent[] };
}

async function createSubmittedEvent(requestId: string, eventId: string, citizenId: string): Promise<void> {
  try {
    await db.createDocument({ ...collection('assistance_request_events', eventId), permissions: [], data: {
      requestId, eventType: 'submitted', actorId: citizenId, occurredAt: new Date().toISOString(),
    } });
  } catch (error) {
    // A repeated attempt with the same operation ID must not duplicate its event.
    try { await db.getDocument(collection('assistance_request_events', eventId)); }
    catch { throw error; }
  }
}

export async function submitCitizenRequest(input: {
  facilityId: string; municipalityId: string; serviceId: string; description: string; requestId: string; eventId: string; citizenId: string;
}): Promise<AssistanceRequest> {
  let request: AssistanceRequest;
  try {
    request = await db.createDocument({ ...collection('assistance_requests', input.requestId), permissions: [], data: {
      citizenId: input.citizenId, facilityId: input.facilityId, municipalityId: input.municipalityId,
      serviceId: input.serviceId, description: input.description, status: 'submitted',
    } }) as unknown as AssistanceRequest;
  } catch (error) {
    // Resolve an uncertain network result using the stable ID prepared before submit.
    try {
      const existing = await db.getDocument(collection('assistance_requests', input.requestId)) as unknown as AssistanceRequest;
      if (existing.description !== input.description || existing.facilityId !== input.facilityId) throw error;
      request = existing;
    } catch { throw error; }
  }
  await createSubmittedEvent(input.requestId, input.eventId, input.citizenId);
  return request;
}

export function newOperationId(): string {
  return crypto.randomUUID();
}
