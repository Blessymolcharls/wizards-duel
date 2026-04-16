import { NextRequest, NextResponse } from "next/server";

const ROOM_TTL_MS = 1000 * 60 * 30;
const MAX_EVENTS_PER_ROOM = 300;

type Role = "host" | "guest";
type EventTarget = Role | "all";

type SignalEvent = {
  id: number;
  type: string;
  from: Role;
  to: EventTarget;
  payload: unknown;
  at: number;
};

type Room = {
  id: string;
  createdAt: number;
  expiresAt: number;
  hostPresent: boolean;
  guestPresent: boolean;
  events: SignalEvent[];
  nextEventId: number;
};

declare global {
  var __wizardsDuelRooms: Map<string, Room> | undefined;
}

const getRoomStore = (): Map<string, Room> => {
  if (!globalThis.__wizardsDuelRooms) {
    globalThis.__wizardsDuelRooms = new Map<string, Room>();
  }
  return globalThis.__wizardsDuelRooms;
};

const cleanupExpiredRooms = (rooms: Map<string, Room>): void => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.expiresAt <= now) {
      rooms.delete(id);
    }
  }
};

const makeRoomId = (): string => {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return id;
};

const createRoom = (): Room => {
  const now = Date.now();
  return {
    id: makeRoomId(),
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
    hostPresent: false,
    guestPresent: false,
    events: [],
    nextEventId: 1,
  };
};

const appendEvent = (
  room: Room,
  event: Omit<SignalEvent, "id" | "at">,
): SignalEvent => {
  const next: SignalEvent = {
    ...event,
    id: room.nextEventId,
    at: Date.now(),
  };
  room.nextEventId += 1;
  room.events.push(next);
  if (room.events.length > MAX_EVENTS_PER_ROOM) {
    room.events.splice(0, room.events.length - MAX_EVENTS_PER_ROOM);
  }
  return next;
};

const getRoom = (rooms: Map<string, Room>, roomId: string): Room | null => {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }
  room.expiresAt = Date.now() + ROOM_TTL_MS;
  return room;
};

export async function POST(req: NextRequest) {
  const rooms = getRoomStore();
  cleanupExpiredRooms(rooms);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Missing request payload." }, { status: 400 });
  }

  const action = (payload as { action?: string }).action;

  if (action === "create-room") {
    let room = createRoom();
    while (rooms.has(room.id)) {
      room = createRoom();
    }
    rooms.set(room.id, room);
    return NextResponse.json({
      roomId: room.id,
      expiresAt: room.expiresAt,
      invitePath: `/duel/${room.id}?role=guest`,
    });
  }

  if (action === "presence") {
    const roomId = (payload as { roomId?: string }).roomId;
    const role = (payload as { role?: Role }).role;
    const present = (payload as { present?: boolean }).present ?? true;

    if (!roomId || (role !== "host" && role !== "guest")) {
      return NextResponse.json({ error: "roomId and role are required." }, { status: 400 });
    }

    const room = getRoom(rooms, roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    if (role === "host") {
      room.hostPresent = present;
      appendEvent(room, {
        type: "presence",
        from: "host",
        to: "guest",
        payload: { hostPresent: present, guestPresent: room.guestPresent },
      });
    } else {
      room.guestPresent = present;
      appendEvent(room, {
        type: "presence",
        from: "guest",
        to: "host",
        payload: { hostPresent: room.hostPresent, guestPresent: present },
      });
    }

    return NextResponse.json({
      ok: true,
      roomId,
      hostPresent: room.hostPresent,
      guestPresent: room.guestPresent,
    });
  }

  if (action === "send") {
    const roomId = (payload as { roomId?: string }).roomId;
    const from = (payload as { from?: Role }).from;
    const to = (payload as { to?: EventTarget }).to;
    const type = (payload as { type?: string }).type;
    const eventPayload = (payload as { payload?: unknown }).payload;

    if (!roomId || (from !== "host" && from !== "guest") || !type) {
      return NextResponse.json(
        { error: "roomId, from, and type are required." },
        { status: 400 },
      );
    }

    const room = getRoom(rooms, roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const target: EventTarget = to ?? (from === "host" ? "guest" : "host");
    const event = appendEvent(room, {
      type,
      from,
      to: target,
      payload: eventPayload ?? null,
    });

    return NextResponse.json({ ok: true, eventId: event.id });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const rooms = getRoomStore();
  cleanupExpiredRooms(rooms);

  const search = req.nextUrl.searchParams;
  const roomId = search.get("roomId") ?? "";
  const role = search.get("role") as Role | null;
  const cursorRaw = search.get("cursor") ?? "0";

  if (!roomId || (role !== "host" && role !== "guest")) {
    return NextResponse.json(
      { error: "roomId and role query params are required." },
      { status: 400 },
    );
  }

  const room = getRoom(rooms, roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const cursor = Number.isFinite(Number(cursorRaw)) ? Number(cursorRaw) : 0;
  const events = room.events.filter(
    (event) => event.id > cursor && (event.to === "all" || event.to === role),
  );

  const nextCursor = events.length ? events[events.length - 1].id : cursor;

  return NextResponse.json({
    roomId,
    hostPresent: room.hostPresent,
    guestPresent: room.guestPresent,
    nextCursor,
    events,
  });
}
