const maps = new Map();

export function renderMap(elementId, data, center, zoom) {
  const element = document.getElementById(elementId);
  if (!element || !window.L) return;
  let state = maps.get(elementId);
  if (!state) {
    const map = window.L.map(element, { scrollWheelZoom: true }).setView(center, zoom);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    const layers = window.L.featureGroup().addTo(map);
    state = { map, layers, weatherLayer: null };
    maps.set(elementId, state);
  }
  if (data.weatherKey && data.weatherEnabled) {
    if (!state.weatherLayer) state.weatherLayer = window.L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(data.weatherKey)}`, { opacity: 0.48, attribution: 'Weather data &copy; <a href="https://openweathermap.org/">OpenWeather</a>' });
    if (!state.map.hasLayer(state.weatherLayer)) state.weatherLayer.addTo(state.map);
  } else if (state.weatherLayer && state.map.hasLayer(state.weatherLayer)) {
    state.map.removeLayer(state.weatherLayer);
  }
  state.layers.clearLayers();
  if (data.userLocation) {
    window.L.circle(data.userLocation, { radius: data.radiusKm * 1000, color: '#1684bd', fillOpacity: 0.08 }).addTo(state.layers);
    window.L.circleMarker(data.userLocation, { radius: 8, color: '#075989', fillColor: '#1684bd', fillOpacity: 1 }).bindPopup('Tu ubicación actual').addTo(state.layers);
  }
  for (const place of data.places || []) {
    const incident = place.kind === 'incident';
    if (incident && place.radiusMeters) window.L.circle([place.latitude, place.longitude], { radius: place.radiusMeters, color: '#d67835', fillColor: '#f1a361', fillOpacity: 0.15 }).addTo(state.layers);
    const details = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = place.name; details.append(title);
    const description = document.createElement('div'); description.textContent = `${place.type} · ${place.municipality}`; details.append(description);
    window.L.circleMarker([place.latitude, place.longitude], { radius: incident ? 8 : 7, color: incident ? '#bd5a25' : '#075989', fillColor: incident ? '#e97837' : '#147fb1', fillOpacity: 1 }).bindPopup(details).addTo(state.layers);
  }
  if (data.places?.length) {
    const bounds = state.layers.getBounds();
    if (bounds.isValid()) state.map.fitBounds(bounds.pad(0.18), { maxZoom: 13 });
  } else {
    state.map.setView(data.userLocation || center, zoom);
  }
  window.setTimeout(() => state.map.invalidateSize(), 50);
}

export function locateUser() {
  if (!navigator.geolocation) return Promise.reject(new Error('GEOLOCATION_UNAVAILABLE'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    error => reject(new Error(error.code === 1 ? 'GEOLOCATION_DENIED' : 'GEOLOCATION_FAILED')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  ));
}

export function disposeMap(elementId) {
  const state = maps.get(elementId);
  if (state) { state.map.remove(); maps.delete(elementId); }
}
