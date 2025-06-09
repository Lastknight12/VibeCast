import { Consumer, Producer, Transport } from "mediasoup/node/lib/types";
import { Stack } from "./stack";
import { User } from "better-auth/types";

type peer = {
  sockets: Stack<string>;
  voiceMuted: boolean;
  producers: {
    screenShare?: {
      video: Producer;
      audio?: Producer;
    };
    audio?: Producer;
  };
  consumers: Map<string, Consumer>;
  transports: {
    send?: Transport;
    recv?: Transport;
  };
  user: Pick<User, "id" | "name" | "image">;
};

export class PeersMap<K> extends Map<K, peer> {
  private cleanupPeerConnection(p: peer) {
    p.voiceMuted = true;

    Object.values(p.transports).forEach((t) => {
      t && t.close();
    });
  }

  get(key: K): (peer & { cleanupPeerConnection: () => void }) | undefined {
    const p = super.get(key);
    if (!p) {
      return undefined;
    }

    if (!("cleanupPeerConnection" in p)) {
      (p as any).cleanupPeerConnection = () => this.cleanupPeerConnection(p);
    }
    return p as peer & { cleanupPeerConnection: () => void };
  }
}
