// Public demo identifiers are defaults; a local .env.local can target a fresh project.
const collectionDefaults = {
  citizenProfiles: 'citizen_profiles', municipalities: 'municipalities', healthcareServices: 'healthcare_services',
  facilities: 'facilities', incidents: 'incidents', facilityServices: 'facility_services',
  facilityOperationalStatus: 'facility_operational_status', facilityStatusHistory: 'facility_status_history',
  resourceAvailability: 'resource_availability', assistanceRequests: 'assistance_requests',
  assistanceRequestEvents: 'assistance_request_events', facilityConfirmations: 'facility_confirmations',
  operationalAuditEvents: 'operational_audit_events',
};
const collectionOverrides = import.meta.env.VITE_APPWRITE_COLLECTIONS_JSON
  ? JSON.parse(import.meta.env.VITE_APPWRITE_COLLECTIONS_JSON) as Partial<typeof collectionDefaults>
  : {};
const collections = Object.freeze({ ...collectionDefaults, ...collectionOverrides });

export const demoConfig = Object.freeze({
  environment: import.meta.env.VITE_APPWRITE_ENVIRONMENT ?? 'dev-synthetic',
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT ?? 'https://nyc.cloud.appwrite.io/v1',
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '6ac82de0000ae8ab05a2',
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID ?? 'pulso-pr',
  bucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID ?? 'facility-images',
  collections,
  facilityId: 'hackathon-demo-pharmacy', requestId: 'hackathon-demo-request',
  openWeatherApiKey: import.meta.env.VITE_OPENWEATHER_API_KEY ?? '',
});
