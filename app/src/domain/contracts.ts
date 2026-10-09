// Persisted fields follow docs/backend/DATA-MODEL v1.1 and HACKATHON-MVP.
export type ProviderType = 'person' | 'organization' | 'community_center';
export interface Facility { $id: string; name: string; municipalityId: string; providerType?: ProviderType; address?: string | null; latitude?: number | null; longitude?: number | null; hours?: string | null; teamId?: string | null; phone?: string | null }
export type RequestStatus = 'submitted' | 'acknowledged' | 'confirmed' | 'declined' | 'completed';
export interface AssistanceRequest { $id: string; citizenId: string; facilityId: string; municipalityId: string; serviceId: string; description: string; status: RequestStatus }
export interface RequestEvent { $id: string; requestId: string; eventType: RequestStatus; actorId: string; occurredAt: string; responseNote?: string }
export interface Confirmation { source: 'FacilityConfirmed' | 'CoordinatorConfirmed' | 'CommunityReported'; confirmedAt: string; validUntil: string }
export function confirmationLabel(value?: Confirmation, now = Date.now()): string {
  if (!value) return 'Sin información de confirmación';
  const start = Date.parse(value.confirmedAt), end = Date.parse(value.validUntil);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= start) return 'Fecha de confirmación inválida';
  if (value.source === 'CommunityReported') return 'Reporte comunitario · no verificado';
  if (now >= end || now - start >= 24 * 60 * 60 * 1000) return 'Sin confirmación reciente';
  return value.source === 'FacilityConfirmed' ? 'Confirmado por el proveedor' : 'Confirmado por coordinación';
}
export const statusText: Record<RequestStatus, string> = { submitted: 'Enviada', acknowledged: 'Recibida', confirmed: 'Ayuda confirmada', declined: 'No disponible', completed: 'Completada' };
