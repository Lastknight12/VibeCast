import { Router } from "mediasoup/node/lib/types";
import { PeersMap } from "src/lib/dataTypes/peersMap";
type RoomType = "private" | "public";

export interface Room {
  name: string;
  type: RoomType;
  router: Router;
  peers: PeersMap;
}

export interface Adapter {
    get(roomId: string): Room | undefined
    create(router: Router, type: RoomType, name: string): string
    getAll(tranformCb: (room: Room, id: string) => void): Room[]
    delete(roomId: string): void
}