import { Client, Databases, ID, Query } from './appwrite-sdk.js';
import { createMvpApi } from './appwrite-api-core.js';

let api;
export function initialize(config) {
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
  api = createMvpApi({ database: new Databases(client), ID, Query, config });
}
function ready() {
  if (!api) throw new Error('APPWRITE_CLIENT_NOT_INITIALIZED');
  return api;
}
export const loadDemoData = () => ready().loadDemoData();
export const saveProvider = (provider, section) => ready().saveProvider(provider, section);
export const respondToRequest = (id, status, note) => ready().respondToRequest(id, status, note);
