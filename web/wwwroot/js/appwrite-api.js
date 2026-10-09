import { Databases, Account, Teams, ID, Query } from './appwrite-sdk.js';
import { createMvpApi, resolvePortalRole } from './appwrite-api-core.js';
import { signInWithSession } from './auth-session-core.js';
import { TabSessionClient } from './tab-session-client.js';

let api;
let account;
let teams;
let client;
export function initialize(config) {
  client = new TabSessionClient(config);
  account = new Account(client);
  teams = new Teams(client);
  api = createMvpApi({ database: new Databases(client), ID, Query, config });
}
function ready() {
  if (!api) throw new Error('APPWRITE_CLIENT_NOT_INITIALIZED');
  return api;
}
export const loadDemoData = (session) => ready().loadDemoData(session);
export const createProvider = (provider) => ready().createProvider(provider);
export const saveProvider = (provider, section) => ready().saveProvider(provider, section);
export const respondToRequest = (id, status, note, actorId) => ready().respondToRequest(id, status, note, actorId);
export const loadGeographicMap = (options) => ready().loadGeographicMap(options);

export async function currentSession() {
  try {
    const user = await account.get();
    const memberships = await Promise.allSettled([
      teams.listMemberships({ teamId: 'hackathon-demo-team', queries: [Query.equal('userId', user.$id), Query.equal('confirm', true)] }),
      teams.listMemberships({ teamId: 'pulso-pr-admins', queries: [Query.equal('userId', user.$id), Query.equal('confirm', true)] })
    ]);
    const teamMemberships = [[], []];
    for (let i = 0; i < memberships.length; i++) {
      const result = memberships[i];
      if (result.status !== 'fulfilled') continue;
      teamMemberships[i] = result.value.memberships || [];
    }
    const role = resolvePortalRole(user.$id, teamMemberships[0], teamMemberships[1]);
    if (!role) return { id: user.$id, name: user.name, email: user.email, role: null, teamId: null };
    return { id: user.$id, name: user.name, email: user.email, ...role };
  } catch { return null; }
}
export async function signIn(email, password) {
  return signInWithSession({ account, currentSession, isolateAccount:operation => client.withFreshSession(operation) }, email, password);
}
export async function signOut() { await account.deleteSession({ sessionId: 'current' }); }
export async function requestRecovery(email, url) { return account.createRecovery({ email, url }); }
export async function finishRecovery(userId, secret, password) { return account.updateRecovery({ userId, secret, password }); }
