import type { NormalizedLandmark } from "@mediapipe/hands";
import type { Point } from "@/utils/gestureUtils";
import {
  filterByMinDistance,
  normalizeGestureInput,
  pathLength,
  smoothPath,
} from "@/utils/gestureUtils";
import { getAllSpells, type SpellDefinition } from "@/utils/spellRegistry";

export type SpellProbability = {
  spell: SpellDefinition;
  confidence: number;
};

export type ProbabilityEvaluationOptions = {
  minStrokeLength: number;
  smoothingFactor: number;
  minMovement: number;
  limit?: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const evaluateSpellProbabilities = (
  rawPath: Point[],
  landmarks: NormalizedLandmark[] | null,
  options: ProbabilityEvaluationOptions,
): SpellProbability[] => {
  if (rawPath.length < 5 || pathLength(rawPath) < options.minStrokeLength * 0.5) {
    return [];
  }

  const cleaned = filterByMinDistance(rawPath, options.minMovement * 0.5);
  if (cleaned.length < 5) {
    return [];
  }

  const smoothed = smoothPath(cleaned, options.smoothingFactor);
  const normalized = normalizeGestureInput(smoothed, {
    resamplePoints: 96,
    targetSize: 220,
  });

  const all = getAllSpells()
    .map((spell) => {
      const confidence = spell.detect(normalized, landmarks ?? []);
      return {
        spell,
        confidence: clamp01(confidence ?? 0),
      };
    })
    .filter((entry) => entry.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  if (typeof options.limit === "number" && options.limit > 0) {
    return all.slice(0, options.limit);
  }

  return all;
};
