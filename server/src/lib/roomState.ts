import { Router } from "mediasoup/node/lib/RouterTypes";
import { PeersMap } from "./peersMap";

export type RoomType = "private" | "public";

export const rooms = new Map<
  string,
  {
    type: RoomType;
    router: Router;
    peers: PeersMap;
  }
>();
