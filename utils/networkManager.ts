import type { SpellId } from "@/utils/spellRegistry";
import type { MotionSegment } from "@/utils/motionGesture";

export type Role = "host" | "guest";

export type SpellCastEvent = {
  type: "CAST_SPELL";
  spellId: SpellId;
  confidence: number;
  timestamp: number;
  playerId: string;
};

export type StateUpdateEvent = {
  type: "STATE_UPDATE";
  gameState: unknown;
  timestamp: number;
};

export type MotionDataEvent = {
  type: "MOTION_DATA";
  segments: MotionSegment[];
  velocity: number;
  timestamp: number;
  spellId?: string;
};

export type ReadyEvent = {
  type: "READY";
  timestamp: number;
};

export type RestartEvent = {
  type: "RESTART";
};

export type PingEvent = {
  type: "PING";
  timestamp: number;
};

export type PongEvent = {
  type: "PONG";
  timestamp: number;
};

export type PeerEvent =
  | SpellCastEvent
  | StateUpdateEvent
  | MotionDataEvent
  | ReadyEvent
  | RestartEvent
  | PingEvent
  | PongEvent;

export type PeerMessage = {
  from: Role;
  payload: PeerEvent;
};

export const encodePeerMessage = (from: Role, payload: PeerEvent): string =>
  JSON.stringify({ from, payload } satisfies PeerMessage);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const hasType = <T extends string>(value: unknown, type: T): value is Record<string, unknown> & { type: T } =>
  isObject(value) && value.type === type;

export const decodePeerMessage = (raw: string): PeerMessage | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return null;
    }

    const from = parsed.from;
    if (from !== "host" && from !== "guest") {
      return null;
    }

    const payload = parsed.payload;
    if (!isObject(payload) || typeof payload.type !== "string") {
      return null;
    }

    const isCastPayload =
      (hasType(payload, "CAST_SPELL") || hasType(payload, "SPELL_CAST" as PeerEvent["type"]))
      && typeof payload.spellId === "string";

    if (isCastPayload) {
      return {
        from,
        payload: {
          type: "CAST_SPELL",
          spellId: payload.spellId as SpellId,
          confidence: Math.max(0, Math.min(1, Number(payload.confidence ?? 1))),
          timestamp: Number(payload.timestamp ?? Date.now()),
          playerId: typeof payload.playerId === "string" ? payload.playerId : from,
        },
      };
    }

    if (hasType(payload, "STATE_UPDATE")) {
      return {
        from,
        payload: {
          type: "STATE_UPDATE",
          gameState: payload.gameState,
          timestamp: Number(payload.timestamp ?? Date.now()),
        },
      };
    }

    if (hasType(payload, "MOTION_DATA") && Array.isArray(payload.segments)) {
      return {
        from,
        payload: {
          type: "MOTION_DATA",
          segments: payload.segments as MotionSegment[],
          velocity: Number(payload.velocity ?? 0),
          timestamp: Number(payload.timestamp ?? Date.now()),
          spellId: typeof payload.spellId === "string" ? payload.spellId : undefined,
        },
      };
    }

    if (hasType(payload, "READY")) {
      return {
        from,
        payload: {
          type: "READY",
          timestamp: Number(payload.timestamp ?? Date.now()),
        },
      };
    }

    if (hasType(payload, "PING")) {
      return {
        from,
        payload: {
          type: "PING",
          timestamp: Number(payload.timestamp ?? Date.now()),
        },
      };
    }

    if (hasType(payload, "PONG")) {
      return {
        from,
        payload: {
          type: "PONG",
          timestamp: Number(payload.timestamp ?? Date.now()),
        },
      };
    }

    if (hasType(payload, "RESTART")) {
      return {
        from,
        payload: { type: "RESTART" },
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const createThrottle = (minIntervalMs: number) => {
  let lastSentAt = 0;
  return <T>(callback: (payload: T) => void, payload: T): boolean => {
    const now = Date.now();
    if (now - lastSentAt < minIntervalMs) {
      return false;
    }
    lastSentAt = now;
    callback(payload);
    return true;
  };
};
