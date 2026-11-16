/** Appels audio — contrat de l'API `/api/v1/calls` (voir backend/docs/APPELS_AUDIO.md). */

export type CallStatus = 'RINGING' | 'ACTIVE' | 'ENDED' | 'CANCELLED' | 'DECLINED' | 'MISSED';
export type CallParticipantStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'JOINED' | 'LEFT' | 'MISSED' | 'CANCELLED';

export interface CallParticipant {
  userId: string;
  name: string | null;
  organizationId: string;
  status: CallParticipantStatus;
  isHost: boolean;
}

export interface CallView {
  id: string;
  conversationId: string;
  kind: 'DIRECT' | 'GROUP';
  status: CallStatus;
  ringExpiresAt: string;
  startedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  me: { status: CallParticipantStatus; isHost: boolean } | null;
  participants: CallParticipant[];
}

export interface LiveKitAccess {
  url: string;
  token: string;
  expiresInSeconds: number;
  audioOnly: true;
}

export interface CallsConfig {
  enabled: boolean;
  reasons: string[];
  audioOnly: true;
  maxParticipants: number;
  ringTimeoutSeconds: number;
  recording: false;
  endToEndEncryption: false;
  push: { android: boolean; iosVoip: boolean };
}

export interface EligiblePeople {
  conversationId: string;
  callable: boolean;
  maxInvitees: number;
  people: Array<{ userId: string; name: string | null; organizationId: string; organizationName: string }>;
}

/** Événements Socket.IO poussés par le serveur (salons `user:<id>`). */
export interface IncomingCallEvent {
  callId: string;
  conversationId: string;
  kind: 'DIRECT' | 'GROUP';
  caller: { userId: string; name: string | null };
  ringExpiresAt: string;
}

export interface CallUpdatedEvent {
  callId: string;
  conversationId: string;
  status: CallStatus;
  participants: Array<{ userId: string; status: CallParticipantStatus }>;
}
