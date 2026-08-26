export type NotificationKind =
  | "tech_unlocked"
  | "construction_complete"
  | "population_growth"
  | "stock_full";

export type NotificationPreferences = Record<NotificationKind, boolean>;

export type NotificationOption = {
  id: NotificationKind;
  label: string;
  description: string;
  icon: string;
};

const STORAGE_KEY = "hexald:notification-prefs";

export const NOTIFICATION_OPTIONS: readonly NotificationOption[] = [
  {
    id: "tech_unlocked",
    label: "Technologies",
    description: "Quand une recherche est terminée",
    icon: "i-lucide-flask-conical"
  },
  {
    id: "construction_complete",
    label: "Constructions",
    description: "Quand un chantier est achevé",
    icon: "i-lucide-hammer"
  },
  {
    id: "population_growth",
    label: "Population",
    description: "Quand un habitant rejoint le village",
    icon: "i-lucide-users"
  },
  {
    id: "stock_full",
    label: "Stocks pleins",
    description: "Bois, blé, pierre, nourriture, éclats",
    icon: "i-lucide-package"
  }
] as const;

const DEFAULT_PREFS: NotificationPreferences = {
  tech_unlocked: true,
  construction_complete: true,
  population_growth: true,
  stock_full: true
};

function normalizePrefs(raw: unknown): NotificationPreferences {
  const out = { ...DEFAULT_PREFS };
  if (!raw || typeof raw !== "object") return out;
  for (const option of NOTIFICATION_OPTIONS) {
    const value = (raw as Record<string, unknown>)[option.id];
    if (typeof value === "boolean") {
      out[option.id] = value;
    }
  }
  return out;
}

function readPrefs(): NotificationPreferences {
  if (!import.meta.client) return { ...DEFAULT_PREFS };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFS };
    return normalizePrefs(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function writePrefs(prefs: NotificationPreferences) {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

/** Préférences notifications in-app — persistées en localStorage. */
export function useNotificationPreferences() {
  const prefs = useState<NotificationPreferences>(
    "notification-prefs",
    () => ({ ...DEFAULT_PREFS })
  );

  if (import.meta.client) {
    onMounted(() => {
      prefs.value = readPrefs();
    });
  }

  const enabledCount = computed(
    () => NOTIFICATION_OPTIONS.filter((option) => prefs.value[option.id]).length
  );

  const totalCount = NOTIFICATION_OPTIONS.length;

  function isEnabled(kind: NotificationKind): boolean {
    return prefs.value[kind] ?? DEFAULT_PREFS[kind];
  }

  function setEnabled(kind: NotificationKind, enabled: boolean) {
    prefs.value = { ...prefs.value, [kind]: enabled };
    writePrefs(prefs.value);
  }

  function toggle(kind: NotificationKind) {
    setEnabled(kind, !isEnabled(kind));
  }

  return {
    prefs,
    enabledCount,
    totalCount,
    isEnabled,
    setEnabled,
    toggle
  };
}
