import { PeersMap } from "src/lib/dataTypes/peersMap";
import { Router } from "mediasoup/node/lib/RouterTypes";
import { RoomsAdapter, Room, RoomType } from "../core/room";

export class RoomsMemoryAdapter implements RoomsAdapter {
  rooms = new Map<string, Room>([]);

  get(id: string) {
    return this.rooms.get(id);
  }

  getAll(type: RoomType | "all"): ReturnType<RoomsAdapter["getAll"]> {
    const result: ReturnType<RoomsAdapter["getAll"]> = [];
    this.rooms.forEach((r, id) => {
      if (type !== "all" && r.type !== type) {
        return;
      }

      result.push({ id, ...r });
    });

    return result;
  }

  create(router: Router, type: "private" | "public", name: string) {
    const uuid = crypto.randomUUID();

    this.rooms.set(uuid, {
      name,
      router,
      peers: new PeersMap(),
      type,
    });

    return uuid;
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
