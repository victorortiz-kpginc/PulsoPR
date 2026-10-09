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

function previewFacility(row: Row): PreviewProvider {
  const facility = row as unknown as Facility;
  const kind = providerType(row);
  const initials = facility.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return {
    facility: { ...facility, providerType: kind }, kind,
    service: 'Medicamentos',
    summary: 'Apoyo comunitario e información de servicios.',
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
  const result = await queryRows('facilities', queries);
  return (result.documents as Row[]).map(previewFacility);
}

export async function getProvider(facilityId: string): Promise<PreviewProvider> {
  const row = await db.getDocument(collection('facilities', facilityId)) as Row;
  const filter = [Query.equal('facilityId', facilityId), Query.limit(100)];
  const [services, statuses, resources, confirmations] = await Promise.all([
    queryRows('facility_services', filter), queryRows('facility_operational_status', filter),
    queryRows('resource_availability', filter), queryRows('facility_confirmations', filter),
  ]);
  const provider = previewFacility(row);
  const service = (services.documents as Row[])[0];
  const status = (statuses.documents as Row[])[0];
  const availability = (resources.documents as Row[])[0];
  const confirmation = asConfirmation((confirmations.documents as Row[])[0]);
  const operationalState = status?.operationalState;
  return {
    ...provider,
    service: typeof service?.serviceId === 'string' ? serviceLabels[service.serviceId] ?? service.serviceId : provider.service,
    summary: typeof service?.note === 'string' ? service.note : provider.summary,
    operational: operationalState === 'operational' ? 'Operativo' : typeof operationalState === 'string' ? operationalState : provider.operational,
    resources: availability ? `${String(availability.resourceType ?? 'Recurso')}: ${String(availability.availability ?? 'sin información')}` : provider.resources,
    electricity: typeof status?.electricityState === 'string' ? status.electricityState : provider.electricity,
    generator: typeof status?.generatorState === 'string' ? status.generatorState : provider.generator,
    confirmation,
  };
}

export async function listCitizenRequests(citizenId = 'demo-citizen'): Promise<AssistanceRequest[]> {
  const result = await queryRows('assistance_requests', [Query.equal('citizenId', citizenId), Query.orderDesc('$createdAt'), Query.limit(100)]);
  return result.documents as unknown as AssistanceRequest[];
}

export async function getCitizenRequest(requestId: string): Promise<{ request: AssistanceRequest; events: RequestEvent[] }> {
  const [request, events] = await Promise.all([
    db.getDocument(collection('assistance_requests', requestId)),
    queryRows('assistance_request_events', [Query.equal('requestId', requestId), Query.orderAsc('occurredAt'), Query.limit(100)]),
  ]);
  return { request: request as unknown as AssistanceRequest, events: events.documents as unknown as RequestEvent[] };
}

async function createSubmittedEvent(requestId: string, eventId: string): Promise<void> {
  try {
    await db.createDocument({ ...collection('assistance_request_events', eventId), permissions: [], data: {
      requestId, eventType: 'submitted', actorId: 'demo-citizen', occurredAt: new Date().toISOString(),
    } });
  } catch (error) {
    // A repeated attempt with the same operation ID must not duplicate its event.
    try { await db.getDocument(collection('assistance_request_events', eventId)); }
    catch { throw error; }
  }
}

export async function submitCitizenRequest(input: {
  facilityId: string; municipalityId: string; serviceId: string; description: string; requestId: string; eventId: string;
}): Promise<AssistanceRequest> {
  let request: AssistanceRequest;
  try {
    request = await db.createDocument({ ...collection('assistance_requests', input.requestId), permissions: [], data: {
      citizenId: 'demo-citizen', facilityId: input.facilityId, municipalityId: input.municipalityId,
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
  await createSubmittedEvent(input.requestId, input.eventId);
  return request;
}

export function newOperationId(): string {
  return crypto.randomUUID();
}
