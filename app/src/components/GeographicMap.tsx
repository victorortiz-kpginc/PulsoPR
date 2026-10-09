import { Fragment, useEffect, useMemo, useState } from 'react';
import { IonButton, IonItem, IonLabel, IonSelect, IonSelectOption, useIonToast } from '@ionic/react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { Link } from 'react-router-dom';
import { municipalityOptions } from '../preview/municipalities';
import { listGeographicPlaces, type GeographicPlace } from '../data/hackathonApi';
import type { ProviderType } from '../domain/contracts';
import { demoConfig } from '../domain/config';
import 'leaflet/dist/leaflet.css';

const puertoRico: [number, number] = [18.2208, -66.5901];

function MapFocus({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom, { animate: false }); requestAnimationFrame(() => map.invalidateSize()); }, [center, zoom, map]);
  return null;
}

export function GeographicMap() {
  const [municipalityId, setMunicipalityId] = useState('72001');
  const [radiusKm, setRadiusKm] = useState(5);
  const [providerType, setProviderType] = useState<'all' | ProviderType>('all');
  const [places, setPlaces] = useState<GeographicPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [location, setLocation] = useState<[number, number]>();
  const [weather, setWeather] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [presentToast] = useIonToast();
  const town = municipalityOptions.find(row => row.code === municipalityId);
  const selected = places.find(place => place.id === selectedId) ?? places[0];
  const center = location ?? (places.length ? [places[0].latitude, places[0].longitude] as [number, number] : puertoRico);
  const zoom = location || places.length ? 12 : 8;
  const providerCount = useMemo(() => places.filter(place => place.kind === 'provider').length, [places]);
  const hasWeatherKey = Boolean(demoConfig.openWeatherApiKey);

  useEffect(() => { void refresh(); }, [municipalityId, radiusKm, providerType, location?.[0], location?.[1]]);

  async function refresh() {
    setBusy(true); setError('');
    try {
      const results = await listGeographicPlaces({ municipalityId: location ? undefined : municipalityId, center: location, radiusKm, providerType: providerType === 'all' ? undefined : providerType });
      setPlaces(results);
      setSelectedId(current => results.some(place => place.id === current) ? current : results[0]?.id);
    } catch {
      setError('No se pudo actualizar la información del mapa. Intenta nuevamente.');
      setPlaces([]); setSelectedId(undefined);
    } finally { setBusy(false); }
  }

  async function locate() {
    try {
      setError('');
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') await Geolocation.requestPermissions();
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
      setLocation([position.coords.latitude, position.coords.longitude]);
      presentToast({ message: 'Ubicación actualizada.', duration: 1800, color: 'success' });
    } catch {
      setError('No se pudo obtener tu ubicación. Revisa los permisos o continúa eligiendo un municipio.');
    }
  }

  return <section className="geo-page" aria-labelledby="geo-title">
    <div className="geo-heading"><div><span className="eyebrow">EXPLORACIÓN TERRITORIAL · PUERTO RICO</span><h1 id="geo-title">Ayuda y contexto cerca de ti</h1><p>Consulta proveedores e información vigente en tu área.</p></div><span className="geo-demo-tag">Mapa comunitario</span></div>
    <div className="geo-toolbar">
      <label className="geo-select-label">Municipio<IonSelect value={municipalityId} interface="popover" aria-label="Selecciona un municipio" onIonChange={event => { setMunicipalityId(event.detail.value); setLocation(undefined); }}>
        {municipalityOptions.map(row => <IonSelectOption key={row.code} value={row.code}>{row.name}</IonSelectOption>)}
      </IonSelect></label>
      <label className="geo-select-label">Distancia<IonSelect value={radiusKm} interface="popover" aria-label="Distancia de búsqueda" onIonChange={event => setRadiusKm(Number(event.detail.value))}>{[2, 5, 10, 25].map(km => <IonSelectOption key={km} value={km}>{km} km</IonSelectOption>)}</IonSelect></label>
      <label className="geo-select-label">Proveedor<IonSelect value={providerType} interface="popover" aria-label="Filtrar por tipo de proveedor" onIonChange={event => setProviderType(event.detail.value)}><IonSelectOption value="all">Todos</IonSelectOption><IonSelectOption value="person">Personas</IonSelectOption><IonSelectOption value="organization">Organizaciones</IonSelectOption><IonSelectOption value="community_center">Centros comunitarios</IonSelectOption></IonSelect></label>
      <IonButton fill={location ? 'solid' : 'outline'} onClick={locate} disabled={busy}><span aria-hidden="true">◎</span>&nbsp; {location ? 'Actualizar ubicación' : 'Usar mi ubicación'}</IonButton>
    </div>
    {error && <div className="geo-error" role="alert">{error}</div>}
    <p className="geo-radius-note">{location ? `El radio de ${radiusKm} km se calcula desde tu ubicación actual.` : 'Elige “Usar mi ubicación” para calcular distancias por radio; mientras tanto, los resultados se limitan al municipio seleccionado.'}</p>
    <div className="geo-layout">
      <div className="geo-map-card">
        <div className="geo-map-topline"><span><strong>{location ? 'Ubicación actual' : town?.name ?? 'Puerto Rico'}</strong> · Puerto Rico</span><span className="geo-live-note"><i /> {busy ? 'Actualizando' : 'Mapa en vivo'}</span></div>
        <div className="geo-map-canvas" aria-label="Mapa real con proveedores e incidentes">
          <MapContainer center={center} zoom={zoom} scrollWheelZoom className="geo-leaflet-map">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {weather && hasWeatherKey && <TileLayer attribution='Weather data &copy; <a href="https://openweathermap.org/">OpenWeather</a>' url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(demoConfig.openWeatherApiKey)}`} opacity={0.48} />}
            <MapFocus center={center} zoom={zoom} />
            {location && <><CircleMarker center={location} radius={9} pathOptions={{ color: '#075989', fillColor: '#1684bd', fillOpacity: 1 }} /><Circle center={location} radius={radiusKm * 1000} pathOptions={{ color: '#1684bd', fillOpacity: 0.08 }} /></>}
            {places.map(place => <Fragment key={place.id}>
              {place.kind === 'incident' && <Circle center={[place.latitude, place.longitude]} radius={place.radiusMeters ?? 0} pathOptions={{ color: '#d67835', fillColor: '#f1a361', fillOpacity: 0.15 }} />}
              <CircleMarker center={[place.latitude, place.longitude]} radius={place.kind === 'incident' ? 9 : 8} eventHandlers={{ click: () => setSelectedId(place.id) }} pathOptions={{ color: place.kind === 'incident' ? '#bd5a25' : '#075989', fillColor: place.kind === 'incident' ? '#e97837' : '#147fb1', fillOpacity: 1 }} />
            </Fragment>)}
          </MapContainer>
        </div>
        <div className="geo-map-legend"><span><i className="legend-provider" /> Proveedor</span><span><i className="legend-incident" /> Incidente</span>{location && <span><i className="legend-user" /> Tu ubicación</span>}<span className="geo-osm-credit">© OpenStreetMap contributors</span></div>
      </div>
      <aside className="geo-side-panel" aria-label="Resultados del mapa">
        <section className="geo-side-section"><div className="geo-section-title"><div><span className="eyebrow">CONTEXTO</span><h2>Capas del mapa</h2></div></div>
          <div className="geo-layer-row"><span><b className="geo-layer-icon weather-icon">☁</b><span><strong>Clima</strong><small>{hasWeatherKey ? 'Nubosidad · OpenWeather' : 'Requiere una clave de OpenWeather'}</small></span></span><input type="checkbox" checked={weather && hasWeatherKey} disabled={!hasWeatherKey} onChange={event => setWeather(event.target.checked)} aria-label="Activar capa de clima" /></div>
          <div className="geo-layer-row"><span><b className="geo-layer-icon traffic-icon">↗</b><span><strong>Tráfico</strong><small>Cobertura de Puerto Rico pendiente de validar</small></span></span><input type="checkbox" disabled aria-label="Capa de tráfico no disponible" /></div>
        </section>
        {selected && <section className="geo-side-section geo-selected-card"><span className="eyebrow">SELECCIÓN EN EL MAPA</span><h2>{selected.name}</h2><span className={`geo-kind ${selected.kind}`}>{selected.type}</span><p>{selected.detail}</p><small>{selected.municipality}{selected.distanceKm !== null ? ` · A ${selected.distanceKm.toFixed(1)} km` : ''}</small>{selected.kind === 'provider' && <Link to={`/resultados?municipioId=${selected.municipalityId}`} className="geo-detail-link">Ver directorio de ayuda <span>→</span></Link>}</section>}
        <section className="geo-side-section"><div className="geo-section-title"><div><span className="eyebrow">CERCA DE {location ? 'TU UBICACIÓN' : (town?.name ?? '').toUpperCase()}</span><h2>Resultados cercanos</h2></div><span className="geo-count">{places.length}</span></div>
          {places.length ? <div className="geo-place-list">{places.map(place => <button key={place.id} className={`geo-place-row ${selectedId === place.id ? 'active' : ''}`} onClick={() => setSelectedId(place.id)}><span className={`geo-place-symbol ${place.kind}`}>{place.kind === 'incident' ? '!' : '＋'}</span><span><strong>{place.name}</strong><small>{place.type}{place.distanceKm !== null ? ` · ${place.distanceKm.toFixed(1)} km` : ''}</small></span><span className="geo-place-arrow">›</span></button>)}</div> : <p className="geo-empty">{error ? 'Los resultados volverán a aparecer al recuperar la conexión.' : 'No hay ubicaciones registradas en esta área todavía.'}</p>}
          <small>{providerCount} proveedores · {places.length - providerCount} incidentes</small>
        </section>
      </aside>
    </div>
    <p className="geo-disclaimer">Los marcadores provienen de ubicaciones registradas en Pulso PR. Confirma disponibilidad antes de acudir. Pulso PR no es un servicio de emergencias.</p>
  </section>;
}
