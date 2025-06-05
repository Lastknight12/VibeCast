import { Router } from "mediasoup/node/lib/RouterTypes";
import { PeersMap } from "./peersMap";

export const rooms = new Map<
  string,
  {
    type: "private" | "public";
    router: Router;
    peers: PeersMap<string>;
  }
>();
