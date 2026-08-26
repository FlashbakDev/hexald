export type TutorialHole = {
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  /**
   * `spotlight` — trou + voile (UI).
   * `pulse` — contour blanc battement sur la tuile (carte), voile sans trou.
   */
  mode?: "spotlight" | "pulse";
  /**
   * Trou clic précis (défaut = rectangle visuel).
   */
  hit?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

export type PlayTutorialStepId =
  | "intro"
  | "select-forest"
  | "place-lumber"
  | "select-expand"
  | "place-plains"
  | "done";

export type PlayTutorialTarget =
  | "header"
  | "map-forest"
  | "build-lumber"
  | "map-expand"
  | "biome-plains"
  | "none";

export type PlayTutorialStep = {
  id: PlayTutorialStepId;
  title: string;
  body: string;
  /** `next` = bouton Suivant ; `action` = avance via geste jeu */
  mode: "next" | "action" | "finish";
  target: PlayTutorialTarget;
};

const STORAGE_KEY = "hexald_play_tutorial_v1";

export const PLAY_TUTORIAL_STEPS: PlayTutorialStep[] = [
  {
    id: "intro",
    title: "Ton bandeau",
    body: "Ici : population, stocks et croissance. Tout ce dont ton village a besoin.",
    mode: "next",
    target: "header"
  },
  {
    id: "select-forest",
    title: "Première récolte",
    body: "Clique une tuile de forêt pour y construire.",
    mode: "action",
    target: "map-forest"
  },
  {
    id: "place-lumber",
    title: "Camp de bûcherons",
    body: "Choisis le camp pour produire du bois.",
    mode: "action",
    target: "build-lumber"
  },
  {
    id: "select-expand",
    title: "Agrandir le monde",
    body: "Clique une case vide autour de ton territoire pour une nouvelle région.",
    mode: "action",
    target: "map-expand"
  },
  {
    id: "place-plains",
    title: "Régioner les plaines",
    body: "Crée une région de plaine — bientôt des fermes.",
    mode: "action",
    target: "biome-plains"
  },
  {
    id: "done",
    title: "Tu es lancé",
    body: "Construis, récolte, étends. Le reste se découvre en jouant.",
    mode: "finish",
    target: "none"
  }
];

function readDone(): boolean {
  if (!import.meta.client) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

function writeDone() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(STORAGE_KEY, "done");
  } catch {
    /* ignore quota / private mode */
  }
}

function clearDone() {
  if (!import.meta.client) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function usePlayTutorial() {
  const active = ref(false);
  const stepIndex = ref(0);

  const step = computed(() => PLAY_TUTORIAL_STEPS[stepIndex.value] ?? null);
  const isLast = computed(
    () => stepIndex.value >= PLAY_TUTORIAL_STEPS.length - 1
  );

  function start() {
    if (readDone()) return;
    stepIndex.value = 0;
    active.value = true;
  }

  /** Dev / debug : efface le flag et relance depuis l’étape 0. */
  function reset() {
    clearDone();
    stepIndex.value = 0;
    active.value = true;
  }

  function complete() {
    active.value = false;
    writeDone();
  }

  function skip() {
    complete();
  }

  function goNext() {
    if (!active.value) return;
    if (isLast.value) {
      complete();
      return;
    }
    stepIndex.value += 1;
  }

  /** Sélection tuile forêt → étape camp. */
  function onTileSelected(input: {
    biome: string | null | undefined;
    canGenerate: boolean;
  }) {
    if (!active.value || !step.value) return;
    if (step.value.id === "select-forest" && input.biome === "forest") {
      goNext();
      return;
    }
    if (step.value.id === "select-expand" && input.canGenerate && !input.biome) {
      goNext();
    }
  }

  function onBuildingPlaced(buildingId: string) {
    if (!active.value || step.value?.id !== "place-lumber") return;
    if (buildingId === "lumber_camp") goNext();
  }

  function onRegionCreated(biome: string) {
    if (!active.value || step.value?.id !== "place-plains") return;
    if (biome === "plains") goNext();
  }

  return {
    active,
    stepIndex,
    step,
    isLast,
    steps: PLAY_TUTORIAL_STEPS,
    start,
    reset,
    skip,
    goNext,
    complete,
    onTileSelected,
    onBuildingPlaced,
    onRegionCreated
  };
}
