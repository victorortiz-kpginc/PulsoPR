// Reuse authenticated identity, never treat an existing session as password validation.
export async function signInWithSession({ account, currentSession, isolateAccount }, email, password) {
  const matches = session => session.email?.toLowerCase() === email.trim().toLowerCase();
  const accept = session => {
    if (!session) throw new Error('SESSION_RECHECK_FAILED');
    if (!matches(session)) throw new Error('DIFFERENT_ACCOUNT_SESSION_ACTIVE');
    if (!session.role) throw new Error('ACCOUNT_WITHOUT_UNIQUE_PORTAL_ROLE');
    return session;
  };
  const existing = await currentSession();
  if (existing) {
    if (!matches(existing) && isolateAccount) {
      return isolateAccount(() => signInWithSession({ account, currentSession }, email, password));
    }
    return accept(existing);
  }
  try {
    await account.createEmailPasswordSession({ email: email.trim(), password });
  } catch (error) {
    // Another tab or an overlapping request may have created the session meanwhile.
    if (error.type !== 'user_session_already_exists') throw error;
    return accept(await currentSession());
  }
  const session = await currentSession();
  if (session && !session.role) {
    await account.deleteSession({ sessionId: 'current' });
  }
  return accept(session);
}
