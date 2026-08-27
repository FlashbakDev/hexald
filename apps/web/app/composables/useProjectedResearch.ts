import { projectResearchSnapshot } from "@hexald/game-core";
import type { WorldResearchSnapshot } from "@hexald/shared";

export function useProjectedResearch(
  research: Ref<WorldResearchSnapshot | null | undefined>,
  now: Ref<number>
) {
  const { accelerateTimers } = useDebugMode();

  return computed(() => {
    const base = research.value;
    if (!base) return null;
    return projectResearchSnapshot(base, now.value, {
      accelerate: accelerateTimers.value
    });
  });
}
