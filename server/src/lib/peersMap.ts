import { Consumer, Producer, Transport } from "mediasoup/node/lib/types";
import { DataList } from "./dataList";
import { User } from "better-auth/types";

interface Peer {
  sockets: DataList<string>;
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
  user: User;
}

export class PeersMap<K extends string = string> extends Map<K, Peer> {
  private cleanupPeerConnection(peer: Peer) {
    Object.values(peer.transports).forEach((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      t && t.close();
    });
  }

  set(key: K, value: Peer) {
    super.set(key, value);
    return this;
  }

  get(key: K) {
    const p = super.get(key);
    if (!p) {
      return undefined;
    }

    return p;
  }

  delete(key: K) {
    const peer = this.get(key);
    if (peer) {
      this.cleanupPeerConnection(peer);
    }

    return super.delete(key);
  }

  clear() {
    for (const peer of this.values()) {
      this.cleanupPeerConnection(peer);
    }

    super.clear();
  }
}
