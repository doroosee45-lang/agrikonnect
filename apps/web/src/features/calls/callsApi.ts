import { api } from '@/services/http';

import type { CallsConfig, CallView, EligiblePeople, LiveKitAccess } from './types';

/**
 * Appels audio — le client n'envoie QUE la conversation et les personnes à
 * inviter. Le serveur décide de tout le reste (salle, droits, jetons).
 */
export const callsApi = {
  config: () => api.get<CallsConfig>('/calls/config'),
  eligible: (conversationId: string) => api.get<EligiblePeople>('/calls/eligible', { params: { conversationId } }),
  list: () => api.get<CallView[]>('/calls'),
  get: (id: string) => api.get<CallView>(`/calls/${encodeURIComponent(id)}`),
  create: (payload: { conversationId: string; inviteeUserIds: string[] }) =>
    api.post<{ call: CallView; livekit: LiveKitAccess; replayed?: boolean }>('/calls', payload),
  accept: (id: string) => api.post<{ call: CallView; livekit: LiveKitAccess }>(`/calls/${encodeURIComponent(id)}/accept`),
  decline: (id: string) => api.post<CallView>(`/calls/${encodeURIComponent(id)}/decline`),
  cancel: (id: string) => api.post<CallView>(`/calls/${encodeURIComponent(id)}/cancel`),
  leave: (id: string) => api.post<CallView>(`/calls/${encodeURIComponent(id)}/leave`),
  end: (id: string) => api.post<CallView>(`/calls/${encodeURIComponent(id)}/end`),
  token: (id: string) => api.post<LiveKitAccess>(`/calls/${encodeURIComponent(id)}/token`),
};
