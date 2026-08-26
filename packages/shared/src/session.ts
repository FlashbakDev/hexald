export type SessionSnapshot = {
  playerId: string;
  pseudo: string | null;
  kind: string;
  email: string | null;
  /** Compte listé dans ADMIN_EMAILS côté API (Firebase requis). */
  isAdmin: boolean;
};

export type FirebaseSessionOutcome = "linked_guest" | "existing" | "created";

export type FirebaseSessionResult = SessionSnapshot & {
  outcome: FirebaseSessionOutcome;
};
