/**
 * Device tilt (gyroscope / orientation) → normalised -1..1 for map parallax.
 * iOS 13+ needs DeviceOrientationEvent.requestPermission() in a user gesture.
 * Desktop: mouse fallback for prototyping.
 */

export type DeviceTiltSample = {
  x: number;
  y: number;
};

export type DeviceTiltDebug = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  eventCount: number;
  source: "gyro" | "mouse" | "none";
  listeningOrientation: boolean;
  listeningMouse: boolean;
  secureContext: boolean;
  needsPrompt: boolean;
  lastStatus: string;
  lastError: string | null;
};

const STORAGE_KEY = "hexald:device-tilt";

type DeviceOrientationPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

type PermFn = () => Promise<"granted" | "denied">;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function isProbablyMobile() {
  if (!import.meta.client) return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

function getOrientationRequestPermission(): PermFn | null {
  if (typeof DeviceOrientationEvent === "undefined") return null;
  const fn = (
    DeviceOrientationEvent as unknown as { requestPermission?: PermFn }
  ).requestPermission;
  return typeof fn === "function" ? fn.bind(DeviceOrientationEvent) : null;
}

function getMotionRequestPermission(): PermFn | null {
  if (typeof DeviceMotionEvent === "undefined") return null;
  const fn = (
    DeviceMotionEvent as unknown as { requestPermission?: PermFn }
  ).requestPermission;
  return typeof fn === "function" ? fn.bind(DeviceMotionEvent) : null;
}

const raw = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };
const angles = {
  alpha: null as number | null,
  beta: null as number | null,
  gamma: null as number | null
};
let eventCount = 0;
let listeningOrientation = false;
let listeningMouse = false;
let smoothRaf = 0;
let subscriberCount = 0;
let bootstrapped = false;

function onOrientation(event: DeviceOrientationEvent) {
  const beta = event.beta;
  const gamma = event.gamma;
  angles.alpha = event.alpha;
  angles.beta = beta;
  angles.gamma = gamma;
  eventCount += 1;
  if (beta == null || gamma == null) return;
  raw.x = clamp(gamma / 32, -1, 1);
  raw.y = clamp((beta - 50) / 40, -1, 1);
}

function onMouseMove(event: MouseEvent) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  angles.alpha = null;
  angles.beta = ((event.clientY / h) * 2 - 1) * 40 + 50;
  angles.gamma = ((event.clientX / w) * 2 - 1) * 30;
  eventCount += 1;
  raw.x = clamp((event.clientX / w) * 2 - 1, -1, 1) * 0.35;
  raw.y = clamp((event.clientY / h) * 2 - 1, -1, 1) * 0.3;
}

function startOrientationListen() {
  if (!import.meta.client) return;
  if (!listeningOrientation) {
    window.addEventListener("deviceorientation", onOrientation, true);
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    listeningOrientation = true;
  }
}

function stopOrientationListen() {
  if (!listeningOrientation) return;
  window.removeEventListener("deviceorientation", onOrientation, true);
  window.removeEventListener("deviceorientationabsolute", onOrientation, true);
  listeningOrientation = false;
}

function startMouseListen() {
  if (listeningMouse || !import.meta.client) return;
  window.addEventListener("mousemove", onMouseMove, { passive: true });
  listeningMouse = true;
}

function stopMouseListen() {
  if (!listeningMouse) return;
  window.removeEventListener("mousemove", onMouseMove);
  listeningMouse = false;
}

export function useDeviceTilt(options: {
  enabled?: boolean;
  mouseFallback?: boolean;
} = {}) {
  const enabled = useState("hx-tilt-enabled", () => {
    if (!import.meta.client) return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch {
      /* ignore */
    }
    return options.enabled ?? true;
  });

  const supported = useState("hx-tilt-supported", () => false);
  const permission = useState<DeviceOrientationPermission>(
    "hx-tilt-permission",
    () => "unsupported"
  );
  const sample = useState<DeviceTiltSample>("hx-tilt-sample", () => ({
    x: 0,
    y: 0
  }));
  const debug = useState<DeviceTiltDebug>("hx-tilt-debug", () => ({
    alpha: null,
    beta: null,
    gamma: null,
    eventCount: 0,
    source: "none",
    listeningOrientation: false,
    listeningMouse: false,
    secureContext: true,
    needsPrompt: false,
    lastStatus: "idle",
    lastError: null
  }));

  const wantsMouseFallback = () =>
    (options.mouseFallback ?? true) &&
    import.meta.client &&
    !isProbablyMobile();

  function persistEnabled(next: boolean) {
    enabled.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function currentSource(): DeviceTiltDebug["source"] {
    if (listeningOrientation) return "gyro";
    if (listeningMouse) return "mouse";
    return "none";
  }

  function patchDebug(partial: Partial<DeviceTiltDebug>) {
    debug.value = { ...debug.value, ...partial };
  }

  function syncListenersToEnabled() {
    if (!import.meta.client) return;
    if (!enabled.value) {
      raw.x = 0;
      raw.y = 0;
      return;
    }
    if (permission.value === "denied") return;
    if (permission.value !== "granted") return;

    if (isProbablyMobile()) {
      startOrientationListen();
      stopMouseListen();
    } else if (wantsMouseFallback()) {
      startMouseListen();
      stopOrientationListen();
    } else {
      startOrientationListen();
    }
  }

  function tickSmooth() {
    smoothRaf = requestAnimationFrame(tickSmooth);
    const targetX = enabled.value ? raw.x : 0;
    const targetY = enabled.value ? raw.y : 0;
    smooth.x = lerp(smooth.x, targetX, 0.18);
    smooth.y = lerp(smooth.y, targetY, 0.18);
    const dx = Math.abs(smooth.x) < 0.01 ? 0 : smooth.x;
    const dy = Math.abs(smooth.y) < 0.01 ? 0 : smooth.y;
    if (sample.value.x !== dx || sample.value.y !== dy) {
      sample.value = { x: dx, y: dy };
    }
    debug.value = {
      ...debug.value,
      alpha: angles.alpha,
      beta: angles.beta,
      gamma: angles.gamma,
      eventCount,
      source: currentSource(),
      listeningOrientation,
      listeningMouse,
      secureContext: window.isSecureContext
    };
  }

  /**
   * Doit être appelé depuis un geste utilisateur (click / touch).
   * Ne pas await quoi que ce soit avant requestPermission() — iOS l’exige.
   */
  async function requestPermission(): Promise<boolean> {
    if (!import.meta.client) return false;

    enabled.value = true;
    persistEnabled(true);
    patchDebug({ lastStatus: "requesting…", lastError: null });

    if (!window.isSecureContext) {
      permission.value = "denied";
      patchDebug({
        lastStatus: "blocked: insecure context",
        lastError:
          "Ouvre en https:// ou localhost (pas une IP http://) — le gyro est bloqué."
      });
      return false;
    }

    const orientPerm = getOrientationRequestPermission();
    const motionPerm = getMotionRequestPermission();

    // Lancer les prompts immédiatement (même tick que le click).
    const pending: Promise<"granted" | "denied">[] = [];
    if (orientPerm) pending.push(orientPerm());
    if (motionPerm) pending.push(motionPerm());

    if (pending.length > 0) {
      try {
        const results = await Promise.all(pending);
        const granted = results.every((r) => r === "granted");
        permission.value = granted ? "granted" : "denied";
        patchDebug({
          lastStatus: granted
            ? `granted (${results.join("+")})`
            : `denied (${results.join("+")})`,
          lastError: granted
            ? null
            : "Permission refusée — Réglages > Safari > Mouvement / orientation."
        });
        if (!granted) return false;
        supported.value = true;
        startOrientationListen();
        stopMouseListen();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        permission.value = "denied";
        patchDebug({
          lastStatus: "request threw",
          lastError: message
        });
        return false;
      }
    }

    // Pas d’API prompt (Android Chrome, Firefox…) : écouter directement.
    permission.value = "granted";
    supported.value = true;
    if (isProbablyMobile() || !wantsMouseFallback()) {
      startOrientationListen();
      stopMouseListen();
      patchDebug({
        lastStatus: "listening (no prompt API)",
        lastError: null
      });
    } else {
      startMouseListen();
      stopOrientationListen();
      patchDebug({
        lastStatus: "mouse fallback",
        lastError: null
      });
    }
    return true;
  }

  /** Alias explicite pour le bouton debug — toujours force une demande. */
  async function authorizeFromUserGesture(): Promise<boolean> {
    // Reset early-return traps (granted + listen mais 0 events).
    if (permission.value === "denied") {
      permission.value = "prompt";
    }
    return requestPermission();
  }

  async function ensurePermission() {
    if (!enabled.value) {
      persistEnabled(true);
    }
    if (
      permission.value === "granted" &&
      listeningOrientation &&
      eventCount > 0
    ) {
      return true;
    }
    return requestPermission();
  }

  function setEnabled(next: boolean) {
    persistEnabled(next);
    if (next) {
      syncListenersToEnabled();
    } else {
      raw.x = 0;
      raw.y = 0;
    }
  }

  function getTilt(): DeviceTiltSample {
    return sample.value;
  }

  if (import.meta.client) {
    onMounted(() => {
      subscriberCount += 1;

      if (!bootstrapped) {
        bootstrapped = true;
        const hasDOE = typeof DeviceOrientationEvent !== "undefined";
        const needsPrompt = Boolean(getOrientationRequestPermission());

        patchDebug({
          secureContext: window.isSecureContext,
          needsPrompt,
          lastStatus: "boot"
        });

        if (!hasDOE && !wantsMouseFallback()) {
          permission.value = "unsupported";
          supported.value = false;
          patchDebug({ lastStatus: "unsupported" });
        } else if (needsPrompt) {
          permission.value = "prompt";
          supported.value = true;
          patchDebug({ lastStatus: "waiting user gesture" });
        } else if (hasDOE) {
          permission.value = "granted";
          supported.value = true;
          syncListenersToEnabled();
          patchDebug({ lastStatus: "auto listen" });
        } else if (wantsMouseFallback()) {
          permission.value = "granted";
          supported.value = true;
          syncListenersToEnabled();
          patchDebug({ lastStatus: "mouse fallback" });
        }

        if (!smoothRaf) smoothRaf = requestAnimationFrame(tickSmooth);
      }
    });

    onUnmounted(() => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0) {
        cancelAnimationFrame(smoothRaf);
        smoothRaf = 0;
        stopOrientationListen();
        stopMouseListen();
        bootstrapped = false;
      }
    });
  }

  return {
    enabled,
    supported,
    permission,
    sample,
    debug,
    getTilt,
    setEnabled,
    ensurePermission,
    requestPermission,
    authorizeFromUserGesture
  };
}
