import test from 'node:test';
import assert from 'node:assert/strict';
import { signInWithSession } from '../wwwroot/js/auth-session-core.js';

const session = { id:'synthetic-provider', email:'provider@example.test', role:'provider' };
function fixture(sessions, error) {
  let creates = 0, deletes = 0;
  const deps = {
    currentSession: async () => sessions.shift(),
    account: {
      createEmailPasswordSession: async () => { creates++; if (error) throw error; },
      deleteSession: async () => { deletes++; }
    }
  };
  return { signIn: (email = session.email) => signInWithSession(deps, email, 'synthetic-password'), calls: () => ({ creates, deletes }) };
}
test('same-account active session is reused without creating or deleting sessions', async () => {
  const api = fixture([session]);
  assert.deepEqual(await api.signIn(' PROVIDER@example.test '), session);
  assert.deepEqual(api.calls(), { creates:0, deletes:0 });
});
test('different active identity cannot be mistaken for the requested account', async () => {
  const api = fixture([session]);
  await assert.rejects(api.signIn('other@example.test'), /DIFFERENT_ACCOUNT_SESSION_ACTIVE/);
  assert.deepEqual(api.calls(), { creates:0, deletes:0 });
});
test('new login creates a session and resolves portal membership', async () => {
  const api = fixture([null, session]);
  assert.deepEqual(await api.signIn(), session);
  assert.deepEqual(api.calls(), { creates:1, deletes:0 });
});
test('session created concurrently by another tab is rechecked', async () => {
  const api = fixture([null, session], { type:'user_session_already_exists', code:401 });
  assert.deepEqual(await api.signIn(), session);
});
test('concurrent login must still match requested identity', async () => {
  const api = fixture([null, session], { type:'user_session_already_exists', code:401 });
  await assert.rejects(api.signIn('other@example.test'), /DIFFERENT_ACCOUNT_SESSION_ACTIVE/);
});
test('invalid credentials are preserved as failures', async () => {
  const error = new Error('Invalid credentials'); error.type='user_invalid_credentials';
  const api = fixture([null], error);
  await assert.rejects(api.signIn(), e => e === error);
});
test('unassigned existing account is reported without deleting its session', async () => {
  const api = fixture([{ ...session, role:null }]);
  await assert.rejects(api.signIn(), /ACCOUNT_WITHOUT_UNIQUE_PORTAL_ROLE/);
  assert.deepEqual(api.calls(), { creates:0, deletes:0 });
});
test('unassigned new login is rejected and its session cleaned up', async () => {
  const api = fixture([null, { ...session, role:null }]);
  await assert.rejects(api.signIn(), /ACCOUNT_WITHOUT_UNIQUE_PORTAL_ROLE/);
  assert.deepEqual(api.calls(), { creates:1, deletes:1 });
});
