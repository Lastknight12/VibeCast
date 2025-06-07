import { Consumer, Producer, Transport } from "mediasoup/node/lib/types";
import { Stack } from "./stack";
import { User } from "better-auth/types";

type peer = {
  sockets: Stack<string>;
  voiceMuted: boolean;
  producers: {
    audio?: Producer<{ userId: string }>;
    video?: Producer<{ userId: string }>;
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

    Object.values(p.consumers).forEach((c) => {
      c.close();
    });
    Object.values(p.producers).forEach((p) => {
      p.close();
    });
    Object.values(p.transports).forEach((t) => {
      t.close();
    });
  }

  get(key: K): (peer & { cleanupPeerConnection: () => void }) | undefined {
    const p = super.get(key);
    if (!p) {
      return undefined;
    }

    return Object.assign(p, {
      cleanupPeerConnection: () => this.cleanupPeerConnection(p),
    }) as peer & { cleanupPeerConnection: () => void };
  }
}
