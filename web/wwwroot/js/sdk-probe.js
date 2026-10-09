import { Client, Databases, Query } from './appwrite-sdk.js';
// Local interop spike only. No authentication, remote reads or mutations.
export function probe() {
  const client = new Client();
  const db = new Databases(client);
  if (typeof db.listDocuments !== 'function' || !Query.equal('providerType', ['person'])) {
    throw new Error('SDK probe failed');
  }
  return 'SDK Appwrite 26.2.0 y JS interop: correctos';
}
