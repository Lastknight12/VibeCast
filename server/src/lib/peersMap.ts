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
  private deleteOldSocket(p: peer) {
    p.voiceMuted = true;
    Object.values(p.transports).forEach((t) => {
      t.close();
    });

    Object.values(p.producers).forEach((p) => {
      p.close();
    });

    Object.values(p.consumers).forEach((c) => {
      c.close();
    });

    p.sockets.pop();
  }

  get(key: K): (peer & { deleteOldConn: () => void }) | undefined {
    const p = super.get(key);
    if (!p) {
      return undefined;
    }

    return {
      ...p!,
      deleteOldConn: () => this.deleteOldSocket(p!),
    };
  }
}
