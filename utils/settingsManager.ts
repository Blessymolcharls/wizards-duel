export type InputMode = "CV" | "MOUSE";

export type DetectionSettings = {
  sensitivity: number;
  smoothingFactor: number;
  confidenceThreshold: number;
  gestureTimeoutMs: number;
  minimumGestureLength: number;
  recognitionDebounceMs: number;
  recognitionFrequencyHz: number;
};

export type TrailSettings = {
  trailLength: number;
  fadeDurationMs: number;
  strokeThickness: number;
};

export type InputModeSettings = {
  mode: InputMode;
  mouse: {
    smoothing: number;
    speedScaling: number;
  };
  camera: {
    mirror: boolean;
    detectionConfidence: number;
    fpsCap: number;
  };
};

export type DuelSettings = {
  detection: DetectionSettings;
  trail: TrailSettings;
  input: InputModeSettings;
};

const SETTINGS_STORAGE_KEY = "wizards-duel.settings.v2";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const DEFAULT_DUEL_SETTINGS: DuelSettings = {
  detection: {
    sensitivity: 0.58,
    smoothingFactor: 0.4,
    confidenceThreshold: 0.45,
    gestureTimeoutMs: 320,
    minimumGestureLength: 60,
    recognitionDebounceMs: 650,
    recognitionFrequencyHz: 24,
  },
  trail: {
    trailLength: 500,
    fadeDurationMs: 700,
    strokeThickness: 4,
  },
  input: {
    mode: "CV",
    mouse: {
      smoothing: 0.35,
      speedScaling: 1,
    },
    camera: {
      mirror: true,
      detectionConfidence: 0.4,
      fpsCap: 24,
    },
  },
};

export const sanitizeDuelSettings = (partial?: Partial<DuelSettings>): DuelSettings => {
  const merged: DuelSettings = {
    detection: {
      ...DEFAULT_DUEL_SETTINGS.detection,
      ...partial?.detection,
    },
    trail: {
      ...DEFAULT_DUEL_SETTINGS.trail,
      ...partial?.trail,
    },
    input: {
      mode: partial?.input?.mode ?? DEFAULT_DUEL_SETTINGS.input.mode,
      mouse: {
        ...DEFAULT_DUEL_SETTINGS.input.mouse,
        ...partial?.input?.mouse,
      },
      camera: {
        ...DEFAULT_DUEL_SETTINGS.input.camera,
        ...partial?.input?.camera,
      },
    },
  };

  merged.detection.sensitivity = clamp(merged.detection.sensitivity, 0.1, 1);
  merged.detection.smoothingFactor = clamp(merged.detection.smoothingFactor, 0.05, 0.95);
  merged.detection.confidenceThreshold = clamp(merged.detection.confidenceThreshold, 0.05, 0.98);
  merged.detection.gestureTimeoutMs = Math.round(clamp(merged.detection.gestureTimeoutMs, 120, 1800));
  merged.detection.minimumGestureLength = Math.round(clamp(merged.detection.minimumGestureLength, 20, 1200));
  merged.detection.recognitionDebounceMs = Math.round(clamp(merged.detection.recognitionDebounceMs, 120, 2400));
  merged.detection.recognitionFrequencyHz = Math.round(clamp(merged.detection.recognitionFrequencyHz, 4, 60));

  merged.trail.trailLength = Math.round(clamp(merged.trail.trailLength, 60, 1200));
  merged.trail.fadeDurationMs = Math.round(clamp(merged.trail.fadeDurationMs, 80, 2400));
  merged.trail.strokeThickness = clamp(merged.trail.strokeThickness, 1, 14);

  merged.input.mouse.smoothing = clamp(merged.input.mouse.smoothing, 0, 0.95);
  merged.input.mouse.speedScaling = clamp(merged.input.mouse.speedScaling, 0.35, 2.8);
  merged.input.camera.detectionConfidence = clamp(merged.input.camera.detectionConfidence, 0.2, 0.98);
  merged.input.camera.fpsCap = Math.round(clamp(merged.input.camera.fpsCap, 8, 60));

  return merged;
};

export const deriveRecognizerSettings = (settings: DuelSettings) => {
  const sensitivity = settings.detection.sensitivity;
  const minMovement = 2 + (1 - sensitivity) * 10;
  const minTrailLength = Math.max(
    settings.detection.minimumGestureLength,
    35 + (1 - sensitivity) * 110,
  );

  return {
    smoothingFactor: settings.detection.smoothingFactor,
    minMovement,
    minTrailLength,
    minGestureLength: settings.detection.minimumGestureLength,
    castDebounceMs: settings.detection.recognitionDebounceMs,
    confidenceThreshold: settings.detection.confidenceThreshold,
    gestureTimeoutMs: settings.detection.gestureTimeoutMs,
    recognitionIntervalMs: Math.round(1000 / settings.detection.recognitionFrequencyHz),
    maxTrailLengthPx: settings.trail.trailLength * 3,
  };
};

export const deriveTrackingSettings = (settings: DuelSettings) => {
  const sensitivity = settings.detection.sensitivity;
  const trackingConfidence = clamp(0.25 + sensitivity * 0.55, 0.2, 0.95);

  return {
    detectionConfidence: settings.input.camera.detectionConfidence,
    trackingConfidence,
    maxHands: 1,
    modelComplexity: 0 as const,
    fpsCap: settings.input.camera.fpsCap,
  };
};

export const loadDuelSettings = (): DuelSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_DUEL_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_DUEL_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<DuelSettings>;
    return sanitizeDuelSettings(parsed);
  } catch {
    return DEFAULT_DUEL_SETTINGS;
  }
};

export const saveDuelSettings = (settings: DuelSettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};
