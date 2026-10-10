import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Account, Client, Databases, ID, Query, Teams } from 'appwrite';
import { resolveDemoSeed } from './provision-fresh-project.mjs';

const SHARED_DEMO_PROJECT_ID = '6ac82de0000ae8ab05a2';
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const seed = JSON.parse(await readFile(new URL('../hackathon/demo.seed.json', import.meta.url), 'utf8'));

function parseArgs(argv) {
  const options = { run: false, projectId: '', endpoint: '', environment: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') options.run = true;
    else if (argv[i] === '--target-project-id') options.projectId = argv[++i] ?? '';
    else if (argv[i] === '--endpoint') options.endpoint = argv[++i] ?? '';
    else if (argv[i] === '--target-environment') options.environment = argv[++i] ?? '';
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true;
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  return options;
}

function requireFreshTarget(options) {
  if (!APPWRITE_ID.test(options.projectId ?? '') || options.projectId === SHARED_DEMO_PROJECT_ID) throw new Error('El smoke requiere un ID Appwrite nuevo y rechaza el proyecto compartido.');
  if (process.env.PULSO_APPWRITE_CONFIRM_PROJECT_ID !== options.projectId) throw new Error('PULSO_APPWRITE_CONFIRM_PROJECT_ID debe coincidir con --target-project-id.');
  if (options.environment !== 'development' || process.env.PULSO_APPWRITE_CONFIRM_ENVIRONMENT !== 'development') throw new Error('El smoke sólo se permite con --target-environment development y confirmación de entorno.');
  if (!/^https:\/\/[a-z0-9-]+\.cloud\.appwrite\.io\/v1$/i.test(options.endpoint ?? '')) throw new Error('Indica el endpoint Cloud regional con --endpoint.');
}

function makeServices(endpoint, projectId) {
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  return { account: new Account(client), databases: new Databases(client), teams: new Teams(client) };
}

async function signIn(persona, endpoint, projectId) {
  const services = makeServices(endpoint, projectId);
  const session = await services.account.createEmailPasswordSession({ email: persona.email, password: process.env[`PULSO_DEMO_${persona.role.toUpperCase()}_PASSWORD`] ?? persona.password });
  if (!session.secret) throw new Error(`Appwrite no devolvió sesión para ${persona.role}.`);
  services.account.client.setSession(session.secret);
  return { ...services, user: await services.account.get() };
}

async function assertMembership(services, teamId, userId) {
  const result = await services.teams.listMemberships({ teamId, queries: [Query.equal('userId', userId), Query.equal('confirm', true)] });
  if (!result.memberships.some(membership => membership.userId === userId)) throw new Error(`Falta membresía confirmada en el Team ${teamId}.`);
}

export async function runSmoke({ endpoint, projectId }) {
  const accounts = resolveDemoSeed(seed).accounts;
  const citizenSeed = accounts.find(account => account.role === 'citizen');
  const providerSeed = accounts.find(account => account.role === 'provider');
  const adminSeed = accounts.find(account => account.role === 'admin');
  const citizen = await signIn(citizenSeed, endpoint, projectId);
  const provider = await signIn(providerSeed, endpoint, projectId);
  const administrator = await signIn(adminSeed, endpoint, projectId);
  await assertMembership(provider, seed.team.id, provider.user.$id);
  await assertMembership(administrator, seed.administrationTeam.id, administrator.user.$id);

  const facility = seed.documents.find(item => item.collectionId === 'facilities' && item.documentId === 'hackathon-demo-pharmacy');
  const serviceId = seed.documents.find(item => item.collectionId === 'facility_services' && item.documentId === 'hackathon-demo-service')?.data.serviceId;
  const requestId = ID.unique();
  const eventId = ID.unique();
  const requests = 'assistance_requests';
  const events = 'assistance_request_events';
  const databaseId = 'pulso-pr';
  await citizen.databases.createDocument({
    databaseId, collectionId: requests, documentId: requestId, permissions: [],
    data: {
      citizenId: citizen.user.$id, facilityId: facility.documentId, serviceId,
      municipalityId: facility.data.municipalityId,
      description: `Fresh-install smoke test ${requestId}; datos sintéticos.`, status: 'submitted',
    },
  });
  await citizen.databases.createDocument({
    databaseId, collectionId: events, documentId: eventId, permissions: [],
    data: { requestId, eventType: 'submitted', actorId: citizen.user.$id, occurredAt: new Date().toISOString() },
  });

  const initial = await provider.databases.getDocument({ databaseId, collectionId: requests, documentId: requestId });
  if (initial.status !== 'submitted' || initial.citizenId !== citizen.user.$id) throw new Error('Proveedor no pudo leer la solicitud ciudadana inicial.');
  await provider.databases.updateDocument({ databaseId, collectionId: requests, documentId: requestId, data: { status: 'acknowledged' } });
  await provider.databases.createDocument({
    databaseId, collectionId: events, documentId: ID.unique(), permissions: [],
    data: { requestId, eventType: 'acknowledged', actorId: provider.user.$id, occurredAt: new Date().toISOString(), responseNote: 'Recibida en el smoke sintético.' },
  });
  const reviewed = await administrator.databases.getDocument({ databaseId, collectionId: requests, documentId: requestId });
  if (reviewed.status !== 'acknowledged') throw new Error('Administración no vio el estado actualizado por el proveedor.');
  const auditEvent = await administrator.databases.listDocuments({ databaseId, collectionId: events, queries: [Query.equal('requestId', requestId), Query.limit(10)] });
  if (auditEvent.documents.length < 2) throw new Error('No se encontraron los eventos de envío y respuesta.');
  return { citizen: 'sign-in + create request/event', provider: 'sign-in + read + acknowledge + event', administrator: 'sign-in + read updated request/events', requestId };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Uso: node backend/setup/fresh-install-smoke.mjs --target-environment development --target-project-id <ID> --endpoint <URL> --run\nEscribe una solicitud y eventos sintéticos. Requiere confirmar el mismo ID y development mediante environment variables.');
    return;
  }
  if (!options.run) { console.log('Dry-run: no se autenticó ni escribió. Añade --run para ejecutar contra un proyecto nuevo autorizado.'); return; }
  requireFreshTarget(options);
  const result = await runSmoke({ endpoint: options.endpoint, projectId: options.projectId });
  console.log(JSON.stringify({ status: 'passed', targetProjectId: options.projectId, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
