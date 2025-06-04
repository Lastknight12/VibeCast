import { User } from "better-auth/types";
import { Consumer } from "mediasoup/node/lib/ConsumerTypes";
import { Producer } from "mediasoup/node/lib/ProducerTypes";
import { Router } from "mediasoup/node/lib/RouterTypes";
import { Transport } from "mediasoup/node/lib/TransportTypes";

export const rooms = new Map<
  string,
  {
    type: "private" | "public";
    router: Router;
    peers: Map<
      string,
      {
        sockets: Set<string>;
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
      }
    >;
  }
>();
