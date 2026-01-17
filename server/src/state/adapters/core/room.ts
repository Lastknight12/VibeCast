import { Router } from "mediasoup/node/lib/types";
import { PeersMap } from "src/lib/dataTypes/peersMap";

export type RoomType = "private" | "public";

export interface Room {
  name: string;
  type: RoomType;
  router: Router;
  peers: PeersMap;
}

export interface RoomsAdapter {
  get(roomId: string): Room | undefined;
  create(router: Router, type: RoomType, name: string): string;
  getAll(type: RoomType | "all"): (Room & { id: string })[];
  delete(roomId: string): void;
}
