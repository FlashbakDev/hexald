export type SessionSnapshot = {
  playerId: string;
  pseudo: string | null;
  kind: string;
  email: string | null;
};

export type FirebaseSessionOutcome = "linked_guest" | "existing" | "created";

export type FirebaseSessionResult = SessionSnapshot & {
  outcome: FirebaseSessionOutcome;
};
