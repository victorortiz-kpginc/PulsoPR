import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IonApp, IonButton, IonContent, IonInput, IonItem, IonLabel, IonPage, IonSelect, IonSelectOption, IonTextarea, IonToast } from '@ionic/react';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { kindText, providers, sampleEvents, sampleRequest, type PreviewProvider, type ProviderKind } from './preview/fixtures';
import { municipalityOptions } from './preview/municipalities';
import { statusText, type AssistanceRequest, type RequestEvent, type RequestStatus } from './domain/contracts';
import { getDemoRequest, getProvider, listCitizenRequests, listMunicipalityOptions, listProviders, municipalityCode, municipalityName, newOperationId, respondToDemoRequest, submitDemoRequest } from './data/hackathonApi';

const kinds: (ProviderKind | 'all')[] = ['all', 'person', 'organization', 'community_center'];
const kindLabel = (kind: string) => kind === 'all' ? 'Todos' : kindText[kind as ProviderKind];
const dateLabel = (value: string) => new Intl.DateTimeFormat('es-PR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
type DataSource = 'loading' | 'appwrite' | 'local';
interface AppDemoState {
  providerRows: PreviewProvider[];
  setProviderRows: (rows: PreviewProvider[]) => void;
  municipalityRows: { code: string; name: string }[];
  requestRows: AssistanceRequest[];
  activeRequest: AssistanceRequest;
  requestEvents: RequestEvent[];
  localStateIds: string[];
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  submitRequest: (provider: PreviewProvider, description: string, requestId: string, eventId: string) => Promise<string>;
  respond: (requestId: string) => Promise<void>;
  refreshRequest: (requestId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
}
const AppDemoContext = createContext<AppDemoState | null>(null);
function useAppDemo() {
  const value = useContext(AppDemoContext);
  if (!value) throw new Error('App demo context is unavailable');
  return value;
}

function Shell({ children, title = 'Pulso PR', back = false }: { children: React.ReactNode; title?: string; back?: boolean }) {
  return <IonPage><header className="topbar"><div className="topbar-inner">{back && <button className="back" onClick={() => history.back()} aria-label="Volver">←</button>}<Link to="/" className="brand"><span className="brand-mark">p</span><span>{title}</span></Link><Link to="/ayuda" className="help-link">Ayuda</Link></div></header><IonContent fullscreen><main className="page-content">{children}</main><footer className="footer"><span>Información comunitaria</span><Link to="/ayuda">Emergencias y contacto</Link></footer></IonContent></IonPage>;
}

function AppRoutes() {
  const [toast, setToast] = useState('');
  const [providerRows, setProviderRows] = useState<PreviewProvider[]>(providers);
  const [municipalityRows, setMunicipalityRows] = useState<{ code: string; name: string }[]>(municipalityOptions.map(row => ({ ...row })));
  const [requestRows, setRequestRows] = useState<AssistanceRequest[]>([sampleRequest]);
  const [activeRequest, setActiveRequest] = useState<AssistanceRequest>(sampleRequest);
  const [requestEvents, setRequestEvents] = useState<RequestEvent[]>(sampleEvents);
  const [localStateIds, setLocalStateIds] = useState<string[]>([sampleRequest.$id]);
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [requestText, setRequestText] = useState('');
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    let mounted = true;
    void listMunicipalityOptions().then(rows => { if (mounted && rows.length) setMunicipalityRows(rows); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const refreshRequests = useCallback(async () => {
    try {
      const rows = await listCitizenRequests();
      const storedIds = new Set(rows.map(row => row.$id));
      setRequestRows(current => [...rows, ...current.filter(row => !storedIds.has(row.$id))]);
      setLocalStateIds(current => current.filter(id => !storedIds.has(id)));
      setDataSource('appwrite');
    } catch { setDataSource('local'); }
  }, []);
  const refreshRequest = useCallback(async (requestId: string) => {
    try {
      const result = await getDemoRequest(requestId);
      setActiveRequest(result.request);
      setRequestEvents(result.events);
      setRequestRows(current => [result.request, ...current.filter(row => row.$id !== requestId)]);
      setLocalStateIds(current => current.filter(id => id !== requestId));
      setDataSource('appwrite');
    } catch { setDataSource('local'); /* Keep the already labeled local/synthetic fallback. */ }
  }, []);
  const submitRequest = async (provider: PreviewProvider, description: string, requestId: string, eventId: string) => {
    let request: AssistanceRequest;
    let event: RequestEvent;
    let storedRemotely = false;
    try {
      request = await submitDemoRequest({ facilityId: provider.facility.$id, municipalityId: provider.facility.municipalityId, serviceId: 'pharmacy', description, requestId, eventId });
      storedRemotely = true;
      event = { $id: eventId, requestId, eventType: 'submitted', actorId: 'demo-citizen', occurredAt: new Date().toISOString() };
      setDataSource('appwrite');
      notify('Solicitud guardada.');
    } catch {
      request = { $id: requestId, citizenId: 'demo-citizen', facilityId: provider.facility.$id, municipalityId: provider.facility.municipalityId, serviceId: 'pharmacy', description, status: 'submitted' };
      event = { $id: eventId, requestId, eventType: 'submitted', actorId: 'demo-citizen', occurredAt: new Date().toISOString() };
      setDataSource('local');
      notify('No se pudo sincronizar; tu solicitud se conserva en esta sesión.');
    }
    setActiveRequest(request);
    setRequestEvents([event]);
    setLocalStateIds(current => storedRemotely ? current.filter(id => id !== requestId) : [...new Set([...current, requestId])]);
    setRequestRows(current => [request, ...current.filter(row => row.$id !== request.$id)]);
    return request.$id;
  };
  const respond = async (requestId: string) => {
    const responseNote = 'Recibimos tu consulta. Verificaremos la disponibilidad y responderemos por este medio.';
    const eventId = newOperationId();
    try {
      const request = await respondToDemoRequest(requestId, eventId, responseNote);
      const event = { $id: eventId, requestId, eventType: 'acknowledged' as const, actorId: 'demo-provider', occurredAt: new Date().toISOString(), responseNote };
      setActiveRequest(request);
      setRequestRows(current => [request, ...current.filter(row => row.$id !== requestId)]);
      setRequestEvents(current => [...current.filter(row => row.$id !== eventId), event]);
      setLocalStateIds(current => current.filter(id => id !== requestId));
      setDataSource('appwrite');
      notify('Respuesta registrada.');
    } catch {
      const now = new Date().toISOString();
      setActiveRequest(current => ({ ...current, $id: requestId, status: 'acknowledged' }));
      setRequestRows(current => current.map(row => row.$id === requestId ? { ...row, status: 'acknowledged' } : row));
      setRequestEvents(current => [...current, { $id: eventId, requestId, eventType: 'acknowledged', actorId: 'demo-provider', occurredAt: now, responseNote }]);
      setLocalStateIds(current => [...new Set([...current, requestId])]);
      setDataSource('local');
      notify('No se pudo sincronizar; la respuesta se conserva en esta sesión.');
    }
  };
  const data: AppDemoState = { providerRows, setProviderRows, municipalityRows, requestRows, activeRequest, requestEvents, localStateIds, dataSource, setDataSource, submitRequest, respond, refreshRequest, refreshRequests };
  return <AppDemoContext.Provider value={data}><><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/resultados" element={<Results />} />
    <Route path="/proveedor/:id" element={<ProviderDetail onRequest={() => notify('No se pudo iniciar esta solicitud. Inténtalo de nuevo.')} />} />
    <Route path="/acceso" element={<Access notify={notify} />} />
    <Route path="/registro" element={<AccountPage title="Crear cuenta" description="Regístrate para dar seguimiento a tus solicitudes." action="Crear cuenta" onDone={() => notify('El registro aún no está disponible.')} />} />
    <Route path="/verificacion" element={<AccountPage title="Verifica tu correo" description="Te enviaremos un enlace para confirmar tu dirección." action="Enviar enlace de verificación" onDone={() => notify('La verificación por correo aún no está disponible.')} />} />
    <Route path="/recuperacion" element={<AccountPage title="Recuperar acceso" description="Escribe tu correo y te indicaremos cómo recuperar el acceso." action="Solicitar recuperación" onDone={() => notify('La recuperación de acceso aún no está disponible.')} />} />
    <Route path="/solicitud/:id" element={<NewRequest text={requestText} setText={setRequestText} onSubmit={submitRequest} />} />
    <Route path="/solicitudes" element={<Requests />} />
    <Route path="/seguimiento/:id" element={<Tracking />} />
    <Route path="/ayuda" element={<Help />} />
    <Route path="*" element={<NotFound />} />
  </Routes><IonToast isOpen={!!toast} message={toast} duration={3500} onDidDismiss={() => setToast('')} position="top" /></></AppDemoContext.Provider>;
}

function Home() {
  const { municipalityRows } = useAppDemo();
  const [municipality, setMunicipality] = useState('Adjuntas');
  const [need, setNeed] = useState('Medicamentos');
  const municipalityId = municipalityRows.find(row => row.name === municipality)?.code ?? municipalityCode(municipality);
  return <Shell><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> APOYO COMUNITARIO EN PUERTO RICO</div><h1>La ayuda empieza<br />con <em>estar conectados.</em></h1><p>Encuentra personas y organizaciones que comparten recursos y apoyo en tu comunidad.</p></div><div className="hero-art" aria-hidden="true"><span className="sun"/><span className="hill hill-one"/><span className="hill hill-two"/><span className="art-home">⌂</span><span className="art-heart">♥</span></div></section><section className="search-panel"><div className="search-heading"><span className="search-icon">⌕</span><div><h2>¿Qué necesitas hoy?</h2><p>Busca apoyo por municipio y servicio.</p></div></div><div className="search-fields"><label className="field-label">Municipio<IonSelect value={municipality} onIonChange={e => setMunicipality(e.detail.value)} interface="popover" aria-label="Municipio">{municipalityRows.map(m => <IonSelectOption key={m.code} value={m.name}>{m.name}</IonSelectOption>)}</IonSelect></label><label className="field-label">Tipo de ayuda<IonSelect value={need} onIonChange={e => setNeed(e.detail.value)} interface="popover" aria-label="Tipo de ayuda">{['Medicamentos', 'Alimentos', 'Artículos esenciales'].map(m => <IonSelectOption key={m} value={m}>{m}</IonSelectOption>)}</IonSelect></label><Link className="button button-primary search-submit" to={`/resultados?municipio=${encodeURIComponent(municipality)}&municipioId=${municipalityId}&servicio=${encodeURIComponent(need)}`}>Buscar apoyo <span>→</span></Link></div><div className="notice"><span>ⓘ</span> Pulso PR conecta comunidades. No es un servicio de emergencias ni garantiza disponibilidad.</div></section><section className="home-bottom"><div><span className="eyebrow">UNA RED, MUCHAS MANOS</span><h2>El apoyo puede venir<br />de distintos lugares.</h2><p>Personas, organizaciones y centros comunitarios participan del mismo flujo de ayuda.</p><Link className="text-link" to="/resultados">Explorar proveedores <span>→</span></Link></div><div className="type-grid">{(['person', 'organization', 'community_center'] as ProviderKind[]).map((kind, index) => <Link to={`/resultados?tipo=${kind}`} className={`type-card type-${index}`} key={kind}><span className="type-symbol">{['♡', '✳', '⌂'][index]}</span><span><strong>{kindLabel(kind)}</strong><small>Ver opciones de apoyo</small></span><span className="arrow">↗</span></Link>)}</div></section><QuickLinks /></Shell>;
}

function QuickLinks() { return <nav className="quick-links" aria-label="Acceso rápido"><Link to="/acceso">Entrar a mi cuenta</Link><Link to="/solicitudes">Mis solicitudes</Link></nav>; }

function Results() {
  const { providerRows, setProviderRows, dataSource, setDataSource } = useAppDemo();
  const [search, setSearch] = useSearchParams();
  const selectedType = search.get('tipo') ?? 'all';
  const municipality = search.get('municipio') ?? 'Adjuntas';
  const selectedMunicipalityId = search.get('municipioId') ?? municipalityCode(municipality);
  const [service, setService] = useState(search.get('servicio') ?? 'Todos los servicios');
  const [mode, setMode] = useState(search.get('estado') ?? '');
  useEffect(() => {
    let mounted = true;
    const providerType = selectedType === 'all' ? undefined : selectedType as ProviderKind;
    void listProviders({ municipalityId: selectedMunicipalityId, providerType }).then(rows => {
      if (mounted) { setProviderRows(rows); setDataSource('appwrite'); }
    }).catch(() => {
      if (mounted) {
        setProviderRows(providers.filter(row => row.facility.municipalityId === selectedMunicipalityId && (selectedType === 'all' || row.kind === selectedType)));
        setDataSource('local');
      }
    });
    return () => { mounted = false; };
  }, [selectedMunicipalityId, selectedType, setProviderRows, setDataSource]);
  const reload = async () => {
    setMode('carga');
    const providerType = selectedType === 'all' ? undefined : selectedType as ProviderKind;
    try {
      const rows = await listProviders({ municipalityId: selectedMunicipalityId, providerType });
      setProviderRows(rows);
      setDataSource('appwrite');
      setMode('');
    } catch {
      setProviderRows(providers.filter(row => row.facility.municipalityId === selectedMunicipalityId && (selectedType === 'all' || row.kind === selectedType)));
      setDataSource('local');
      setMode('error');
    }
  };
  const filtered = useMemo(() => providerRows.filter(p => service === 'Todos los servicios' || p.service === service), [providerRows, service]);
  const statusNote = mode === 'vacio' ? 'No encontramos opciones con esta combinación. Prueba quitar un filtro.' : mode === 'error' ? 'No pudimos actualizar los resultados. Revisa tu conexión e inténtalo de nuevo.' : mode === 'offline' ? 'Sin conexión. Se muestran referencias guardadas para consultar sin conexión.' : mode === 'carga' ? 'Actualizando proveedores…' : '';
  return <Shell title="Explorar apoyo" back><div className="eyebrow">RESULTADOS · {municipality.toUpperCase()}</div><h1 className="page-title">Apoyo cerca de ti</h1><p className="page-lead">Personas y organizaciones de la comunidad que ofrecen recursos.</p><div className="filter-bar"><label className="filter-select">Tipo<IonSelect value={selectedType} onIonChange={e => { const next = new URLSearchParams(search); next.set('tipo', e.detail.value); setSearch(next); }} interface="popover">{kinds.map(k => <IonSelectOption key={k} value={k}>{kindLabel(k)}</IonSelectOption>)}</IonSelect></label><label className="filter-select">Servicio<IonSelect value={service} onIonChange={e => setService(e.detail.value)} interface="popover">{['Todos los servicios', 'Medicamentos', 'Alimentos', 'Artículos esenciales'].map(s => <IonSelectOption key={s} value={s}>{s}</IonSelectOption>)}</IonSelect></label><button className="filter-reset" onClick={() => { setService('Todos los servicios'); setSearch({ municipio: municipality, municipioId: selectedMunicipalityId }); }}>Limpiar</button></div>{dataSource === 'local' && <div className="state-banner" role="status">Guardadas en este dispositivo: Appwrite no responde desde este entorno.</div>}{statusNote && <div className={`state-banner ${mode === 'error' ? 'state-error' : ''}`} role="status">{statusNote}{mode === 'error' && <button onClick={() => void reload()}>Reintentar</button>}</div>}<div className="result-summary"><strong>{mode === 'vacio' ? 0 : filtered.length} opciones</strong><button className="filter-reset" onClick={() => void reload()}>Actualizar</button></div>{mode !== 'vacio' && <div className="provider-list">{filtered.map(p => <ProviderCard key={p.facility.$id} provider={p} />)}</div>}<div className="demo-note">Encuentra apoyo disponible en tu comunidad.</div></Shell>;
}

function ProviderCard({ provider: p }: { provider: PreviewProvider }) {
  const { municipalityRows } = useAppDemo();
  const town = municipalityRows.find(row => row.code === p.facility.municipalityId)?.name ?? municipalityName(p.facility.municipalityId);
  const confirmation = !p.confirmation ? 'Sin información reciente' : p.confirmation.source === 'CommunityReported' ? 'Reporte comunitario' : Date.parse(p.confirmation.validUntil) <= Date.now() || Date.now() - Date.parse(p.confirmation.confirmedAt) >= 86400000 ? 'Sin confirmación reciente' : 'Confirmado recientemente';
  return <Link to={`/proveedor/${p.facility.$id}`} className="provider-card"><div className={`avatar avatar-${p.color}`}>{p.initials}</div><div className="provider-main"><div className="provider-heading"><h3>{p.facility.name}</h3><span className="verified-mark" aria-label="Perfil comunitario">✓</span></div><div className="provider-meta"><span className={`type-pill pill-${p.kind}`}>{kindLabel(p.kind)}</span><span>{town}</span></div><p>{p.service} <span className="bullet">·</span> {p.summary}</p><div className={`status-line ${p.operational === 'Operativo' ? 'status-good' : 'status-muted'}`}><span className="status-dot" />{p.operational}<span className="bullet">·</span>{confirmation}</div></div><span className="card-arrow">→</span></Link>;
}

function ProviderDetail({ onRequest }: { onRequest: () => void }) {
  const { providerRows } = useAppDemo();
  const { id } = useParams();
  const fallback = providerRows.find(provider => provider.facility.$id === id) ?? providers.find(provider => provider.facility.$id === id) ?? providers[0];
  const [loadedProvider, setLoadedProvider] = useState<PreviewProvider | null>(null);
  useEffect(() => { let mounted = true; setLoadedProvider(null); if (id) void getProvider(id).then(value => { if (mounted) setLoadedProvider(value); }).catch(() => undefined); return () => { mounted = false; }; }, [id]);
  const p = loadedProvider ?? fallback;
  const navigate = useNavigate();
  const recent = p.confirmation && Date.parse(p.confirmation.validUntil) > Date.now() && Date.now() - Date.parse(p.confirmation.confirmedAt) < 86400000;
  return <Shell title="Perfil comunitario" back><Link to="/resultados" className="text-link">← Volver a resultados</Link><section className="detail-hero"><div className={`avatar avatar-large avatar-${p.color}`}>{p.initials}</div><span className={`type-pill pill-${p.kind}`}>{kindLabel(p.kind)}</span><h1>{p.facility.name}</h1><p>{p.service} · {p.facility.municipalityId === '72001' ? 'Adjuntas, Puerto Rico' : 'Puerto Rico'}</p><div className={`detail-status ${recent ? 'status-good' : 'status-muted'}`}><span className="status-dot" />{recent ? p.operational : 'Sin confirmación reciente'}</div></section><div className="detail-grid"><section className="content-card"><h2>Sobre este proveedor</h2><p>{p.summary}</p><div className="detail-row"><span>Dirección</span><strong>{p.facility.address ?? 'No compartida'}</strong></div><div className="detail-row"><span>Horario</span><strong>{p.facility.hours ?? 'Consultar directamente'}</strong></div><div className="detail-row"><span>Servicios</span><strong>{p.service}</strong></div><div className="detail-row"><span>Recursos</span><strong>{p.resources}</strong></div><div className="detail-row"><span>Electricidad</span><strong>{p.electricity}</strong></div><div className="detail-row"><span>Generador</span><strong>{p.generator}</strong></div></section><aside className="content-card confirmation-card"><span className="eyebrow">ACTUALIZACIÓN</span><h2>{p.confirmation?.source === 'CommunityReported' ? 'Reporte de la comunidad' : recent ? 'Confirmación reciente' : 'Sin información reciente'}</h2><p>{p.confirmation ? `Actualizado ${dateLabel(p.confirmation.confirmedAt)}.` : 'Este perfil no tiene una actualización reciente.'}</p><small>La información puede cambiar. Confirma los detalles directamente antes de trasladarte.</small><a className="button button-outline" href="tel:+17875550100">Llamar al proveedor</a></aside></div><div className="detail-actions"><button className="button button-primary" onClick={() => navigate(`/solicitud/${p.facility.$id}`)}>Solicitar ayuda no urgente <span>→</span></button><button className="button button-quiet" onClick={onRequest}>¿Cómo funciona?</button></div><div className="notice"><span>ⓘ</span> No uses Pulso PR para emergencias. Si alguien está en peligro inmediato, llama al 9-1-1.</div></Shell>;
}

function Access({ notify }: { notify: (s: string) => void }) {
  return <Shell title="Tu cuenta" back><div className="form-wrap"><div className="eyebrow">BIENVENIDO/A DE NUEVO</div><h1 className="page-title">Continúa con tu comunidad.</h1><p className="page-lead">Inicia sesión para enviar y seguir solicitudes.</p><div className="content-card form-card"><label className="field-label">Correo electrónico<IonInput type="email" placeholder="tu@correo.com" /></label><label className="field-label">Contraseña<IonInput type="password" placeholder="Tu contraseña" /></label><button className="button button-primary full-width" onClick={() => notify('El acceso por correo aún no está disponible.')}>Iniciar sesión</button><Link to="/recuperacion" className="text-link centered">¿Olvidaste tu contraseña?</Link><div className="form-divider"><span>o</span></div><p className="centered muted-text">¿Todavía no tienes cuenta?</p><Link className="button button-outline full-width" to="/registro">Crear una cuenta</Link></div><p className="demo-note centered">Continúa sin cuenta para explorar los recursos disponibles.</p><p className="centered"><Link className="text-link" to="/resultados">Continuar como ciudadano →</Link></p></div></Shell>;
}

function AccountPage({ title, description, action, onDone }: { title: string; description: string; action: string; onDone: () => void }) {
  return <Shell title={title} back><div className="form-wrap"><div className="eyebrow">TU CUENTA</div><h1 className="page-title">{title}</h1><p className="page-lead">{description}</p><div className="content-card form-card"><label className="field-label">Correo electrónico<IonInput type="email" placeholder="tu@correo.com" /></label>{title === 'Crear cuenta' && <><label className="field-label">Nombre<IonInput placeholder="Tu nombre" /></label><label className="field-label">Contraseña<IonInput type="password" placeholder="Crea una contraseña" /></label></>}<button className="button button-primary full-width" onClick={onDone}>{action}</button><Link className="text-link centered" to="/acceso">Volver a iniciar sesión</Link></div><p className="demo-note centered">El correo aún no está disponible.</p></div></Shell>;
}

function NewRequest({ text, setText, onSubmit }: { text: string; setText: (s: string) => void; onSubmit: (provider: PreviewProvider, description: string, requestId: string, eventId: string) => Promise<string> }) {
  const { providerRows } = useAppDemo();
  const { id } = useParams();
  const provider = providerRows.find(p => p.facility.$id === id) ?? providers.find(p => p.facility.$id === id) ?? providers[0];
  const navigate = useNavigate();
  const [requestId] = useState(newOperationId());
  const [eventId] = useState(newOperationId());
  const [saving, setSaving] = useState(false);
  return <Shell title="Solicitar apoyo" back><div className="form-wrap wide-form"><Link to={`/proveedor/${provider.facility.$id}`} className="text-link">← {provider.facility.name}</Link><div className="eyebrow">SOLICITUD NO URGENTE</div><h1 className="page-title">Cuéntanos qué necesitas.</h1><p className="page-lead">Comparte sólo la información mínima para que puedan responderte.</p><div className="content-card form-card"><div className="request-target"><span className="mini-avatar">{provider.initials}</span><div><strong>{provider.facility.name}</strong><small>{kindLabel(provider.kind)} · {provider.service}</small></div></div><label className="field-label">Tipo de ayuda<IonSelect value={provider.service} interface="popover">{[provider.service, 'Alimentos', 'Artículos esenciales'].map(s => <IonSelectOption key={s}>{s}</IonSelectOption>)}</IonSelect></label><label className="field-label">Mensaje<IonTextarea value={text} onIonInput={e => setText(e.detail.value ?? '')} autoGrow maxlength={240} placeholder="Describe brevemente lo que necesitas. No incluyas información médica." /></label><div className="character-count">{text.length}/240 caracteres</div><div className="notice"><span>ⓘ</span> No incluyas diagnósticos ni información médica. Enviar una solicitud no garantiza que la ayuda esté disponible.</div><label className="consent-line"><input type="checkbox" defaultChecked /> Entiendo que mi solicitud se compartirá con este proveedor.</label><button className="button button-primary full-width" onClick={async () => { setSaving(true); const savedId = await onSubmit(provider, text.trim(), requestId, eventId); setSaving(false); setText(''); navigate(`/seguimiento/${savedId}`); }} disabled={text.trim().length < 3 || saving}>{saving ? 'Guardando…' : 'Revisar y enviar'} <span>→</span></button></div><p className="demo-note centered">Tu información se utilizará para atender esta solicitud.</p></div></Shell>;
}

function Requests() {
  const { requestRows, providerRows, dataSource, localStateIds, refreshRequests } = useAppDemo();
  const [tab, setTab] = useState('Activas');
  useEffect(() => { void refreshRequests(); }, [refreshRequests]);
  const activeRows = requestRows.filter(row => row.status !== 'completed' && row.status !== 'declined');
  const pastRows = requestRows.filter(row => row.status === 'completed' || row.status === 'declined');
  const visibleRows = tab === 'Activas' ? activeRows : pastRows;
  return <Shell title="Mis solicitudes" back><div className="eyebrow">TU ACTIVIDAD</div><h1 className="page-title">Mis solicitudes</h1><p className="page-lead">Consulta respuestas y actualizaciones de tus solicitudes.</p><div className="result-summary"><span>{dataSource === 'local' ? 'Guardadas en este dispositivo' : 'Datos actualizados al abrir la pantalla'}</span><button className="filter-reset" onClick={() => void refreshRequests()}>Actualizar</button></div><div className="tabs"><button className={tab === 'Activas' ? 'selected' : ''} onClick={() => setTab('Activas')}>Activas <span>{activeRows.length}</span></button><button className={tab === 'Anteriores' ? 'selected' : ''} onClick={() => setTab('Anteriores')}>Anteriores</button></div>{visibleRows.length ? visibleRows.map(row => { const provider = providerRows.find(p => p.facility.$id === row.facilityId); const created = (row as AssistanceRequest & { $createdAt?: string }).$createdAt ?? sampleEvents[0].occurredAt; return <Link key={row.$id} to={`/seguimiento/${row.$id}`} className="request-card"><div className="request-card-top"><span className="type-pill pill-organization">{provider?.facility.name ?? 'Proveedor de ayuda'}</span><span className="muted-text">{dateLabel(created)}</span></div><h2>Solicitud a {provider?.facility.name ?? 'proveedor de ayuda'}</h2><p>{row.description}</p>{localStateIds.includes(row.$id) && <small className="muted-text">Pendiente de sincronizar</small>}<div className="request-card-bottom"><span className="status-dot" />{statusText[row.status]}<span className="card-arrow">→</span></div></Link>; }) : <div className="empty-state"><div className="empty-icon">⌁</div><h2>{tab === 'Activas' ? 'Aún no tienes solicitudes activas' : 'Aún no tienes solicitudes anteriores'}</h2><p>{tab === 'Activas' ? 'Cuando envíes una solicitud aparecerá aquí.' : 'Las solicitudes completadas aparecerán aquí.'}</p><Link className="text-link" to="/resultados">Explorar apoyo →</Link></div>}<div className="demo-note">Aquí puedes consultar el estado y las actualizaciones de tus solicitudes.</div></Shell>;
}

function Tracking() {
  const { id } = useParams();
  const { requestRows, activeRequest, requestEvents, providerRows, localStateIds, dataSource, respond, refreshRequest } = useAppDemo();
  useEffect(() => { if (id) void refreshRequest(id); }, [id, refreshRequest]);
  const request = requestRows.find(row => row.$id === id) ?? (activeRequest.$id === id ? activeRequest : sampleRequest);
  const provider = providerRows.find(row => row.facility.$id === request.facilityId) ?? providers.find(row => row.facility.$id === request.facilityId) ?? providers[0];
  const events = activeRequest.$id === request.$id ? requestEvents : request.$id === sampleRequest.$id ? sampleEvents : [];
  const visibleEvents = request.status === 'submitted' ? events.filter(event => event.eventType === 'submitted') : events;
  const created = (request as AssistanceRequest & { $createdAt?: string }).$createdAt ?? events[0]?.occurredAt ?? sampleEvents[0].occurredAt;
  return <Shell title="Seguimiento" back><div className="eyebrow">SOLICITUD · {request.$id.slice(0, 12).toUpperCase()}</div><h1 className="page-title">Tu solicitud</h1><p className="page-lead">Creada {dateLabel(created)}</p>{localStateIds.includes(request.$id) && <div className="state-banner">Este cambio está pendiente de sincronizar. Revisa tu conexión.</div>}<button className="filter-reset" onClick={() => void refreshRequest(request.$id)}>Actualizar estado</button><section className="content-card tracking-card"><div className="tracking-head"><div><span className="type-pill pill-organization">{provider.facility.name}</span><h2>{request.description}</h2></div><span className="status-chip">{statusText[request.status]}</span></div><div className="timeline">{visibleEvents.map((item, i) => <div className="timeline-item" key={item.$id}><span className={`timeline-dot ${i === visibleEvents.length - 1 ? 'active' : ''}`} /><div><strong>{statusText[item.eventType]}</strong><small>{dateLabel(item.occurredAt)} · {item.actorId === 'demo-citizen' ? 'Tú' : 'Proveedor de ayuda'}</small>{item.responseNote && request.status !== 'submitted' && <p className="response-note">“{item.responseNote}”</p>}</div></div>)}</div>{request.status === 'submitted' && <button className="button button-outline" onClick={() => void respond(request.$id)}>Registrar respuesta del proveedor</button>}</section><div className="notice"><span>ⓘ</span> Una solicitud enviada no confirma disponibilidad ni garantiza atención.</div><Link to="/solicitudes" className="text-link">← Volver a mis solicitudes</Link></Shell>;
}

function Help() { return <Shell title="Ayuda y seguridad" back><div className="eyebrow">ESTAMOS PARA ORIENTARTE</div><h1 className="page-title">Ayuda para usar Pulso PR.</h1><p className="page-lead">Conoce el alcance de esta herramienta y dónde buscar ayuda urgente.</p><div className="help-grid"><section className="content-card emergency-card"><span className="help-icon">!</span><span className="eyebrow">EMERGENCIA</span><h2>¿Hay peligro inmediato?</h2><p>Pulso PR no atiende emergencias. Si alguien está en peligro inmediato, llama al servicio oficial de emergencias.</p><a className="button button-primary" href="tel:911">Llamar al 9-1-1</a></section><section className="content-card"><span className="eyebrow">SOBRE PULSO PR</span><h2>Coordinación comunitaria, no urgente.</h2><p>La información es compartida por proveedores de ayuda. Verifica directamente horarios y disponibilidad antes de salir.</p><div className="detail-row"><span>Datos mostrados</span><strong>Información de proveedores</strong></div><div className="detail-row"><span>Mensajes</span><strong>No se envían automáticamente</strong></div></section><section className="content-card"><span className="eyebrow">CONTACTO</span><h2>¿Necesitas orientación?</h2><p>El canal de soporte aún no está disponible.</p><Link to="/resultados" className="text-link">Volver a explorar proveedores →</Link></section></div></Shell>; }

function NotFound() { return <Shell title="Página no encontrada" back><div className="empty-state"><h1>No encontramos esta página.</h1><Link to="/" className="button button-primary">Volver al inicio</Link></div></Shell>; }

function App() { return <IonApp><BrowserRouter><AppRoutes /></BrowserRouter></IonApp>; }
export default App;
