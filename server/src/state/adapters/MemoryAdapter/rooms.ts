import { PeersMap } from "src/lib/dataTypes/peersMap";
import { Router } from "mediasoup/node/lib/RouterTypes";
import { RoomsAdapter, Room } from "../core/room";

export class RoomsMemoryAdapter implements RoomsAdapter {
  rooms = new Map<string, Room>();

  get(id: string) {
    return this.rooms.get(id);
  }

  getAll(): Room[] {
    const result: Room[] = [];
    this.rooms.forEach((r) => {
      result.push(r);
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
