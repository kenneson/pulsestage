export const SESSION_STATUSES = ["draft", "live", "paused", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export function isSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

export function toSessionStatus(value: string): SessionStatus {
  return isSessionStatus(value) ? value : "draft";
}

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  draft: ["live"],
  live: ["paused", "completed"],
  paused: ["live", "completed"],
  completed: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "Rascunho",
  live: "Ao vivo",
  paused: "Pausada",
  completed: "Encerrada",
};

export const JOIN_CODE_REGEX = /^[A-Z0-9]{4,10}$/;
const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateJoinCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
  return code;
}

export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const MAX_PARTICIPANTS_PER_SESSION = 2000;
