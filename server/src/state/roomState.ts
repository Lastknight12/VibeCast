import { Router } from "mediasoup/node/lib/RouterTypes";
import { PeersMap } from "src/lib/dataTypes/peersMap";

export type RoomType = "private" | "public";

export interface Room {
  name: string;
  type: RoomType;
  router: Router;
  peers: PeersMap;
}

export const rooms = new Map<string, Room>();
