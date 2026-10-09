import { Client, AppwriteException } from './appwrite-sdk.js';

// Appwrite's documented fallback-cookie header, isolated to this web tab.
// Do not use the SDK's shared cookie/localStorage persistence: it also reaches the app.
export class TabSessionClient extends Client {
  constructor(config) {
    super();
    this.setEndpoint(config.endpoint).setProject(config.projectId);
    this.sessionKey = `pulso:web:session:${config.endpoint}:${config.projectId}`;
  }
  getTabSession() { return sessionStorage.getItem(this.sessionKey); }
  setTabSession(value) {
    if (value) sessionStorage.setItem(this.sessionKey, value);
    else sessionStorage.removeItem(this.sessionKey);
  }
  async withFreshSession(operation) {
    const previous = this.getTabSession();
    this.setTabSession(null);
    try { return await operation(); }
    catch (error) { this.setTabSession(previous); throw error; }
  }
  prepareRequest(method, url, headers = {}, params = {}) {
    const request = super.prepareRequest(method, url, headers, params);
    request.options.credentials = 'omit';
    for (const key of Object.keys(request.options.headers)) {
      if (key.toLowerCase() === 'x-fallback-cookies') delete request.options.headers[key];
    }
    const cookie = this.getTabSession();
    if (cookie) request.options.headers['X-Fallback-Cookies'] = cookie;
    return request;
  }
  async call(method, url, headers = {}, params = {}, responseType = 'json') {
    const { uri, options } = this.prepareRequest(method, url, headers, params);
    const response = await fetch(uri, options);
    const json = response.headers.get('content-type')?.includes('application/json');
    const data = json ? await response.json() : responseType === 'arrayBuffer' ? await response.arrayBuffer() : { message:await response.text() };
    if (!response.ok) throw new AppwriteException(data.message || 'Appwrite request failed', response.status, data.type || '', data);
    const fallback = response.headers.get('x-fallback-cookies');
    if (fallback) this.setTabSession(fallback);
    if (method.toUpperCase() === 'POST' && url.pathname.endsWith('/account/sessions/email') && !this.getTabSession()) {
      throw new Error('TAB_SESSION_UNAVAILABLE');
    }
    if (method.toUpperCase() === 'DELETE' && url.pathname.endsWith('/account/sessions/current')) this.setTabSession(null);
    return data;
  }
}
