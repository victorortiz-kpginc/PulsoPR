import { Account, Client, ID } from 'appwrite';
import { demoConfig } from '../domain/config';

const account = new Account(new Client().setEndpoint(demoConfig.endpoint).setProject(demoConfig.projectId));
export interface CitizenAccount { $id: string; name: string; email: string }

export async function currentAccount(): Promise<CitizenAccount | null> {
  try {
    const user = await account.get();
    return { $id: user.$id, name: user.name, email: user.email };
  }
  catch { return null; }
}

export async function signIn(email: string, password: string): Promise<CitizenAccount> {
  await account.createEmailPasswordSession({ email, password });
  const user = await account.get();
  return { $id: user.$id, name: user.name, email: user.email };
}

export async function registerCitizen(name: string, email: string, password: string): Promise<CitizenAccount> {
  await account.create({ userId: ID.unique(), name, email, password });
  try {
    await account.createEmailPasswordSession({ email, password });
    const user = await account.get();
    return { $id: user.$id, name: user.name, email: user.email };
  } catch (error) {
    throw new Error('ACCOUNT_CREATED_SESSION_FAILED', { cause: error });
  }
}

export async function signOut(): Promise<void> { await account.deleteSession({ sessionId: 'current' }); }

export async function sendRecovery(email: string): Promise<void> {
  await account.createRecovery({ email, url: `${window.location.origin}/recuperacion` });
}

export async function completeRecovery(userId: string, secret: string, password: string): Promise<void> {
  await account.updateRecovery({ userId, secret, password });
}
