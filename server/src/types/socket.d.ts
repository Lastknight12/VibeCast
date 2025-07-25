import { DefaultEventsMap, type Socket } from "socket.io";
import { ServerToClientEvents, CustomOn, EventError } from "src/socket/core";
import { User } from "better-auth/*";

import { ProducerType } from "mediasoup/node/lib/types";
import { User } from "better-auth/types";

export interface ServerToClientEvents {
  error: (payload: EventError) => void;
  newProducer: (producerId: string, userId: string, type: ProducerType) => void;
  consumerClosed: (consumerId: string) => void;
  peerClosedProducer: (data: {
    peerId: string;
    type: "screenShare" | "audio";
  }) => void;
  addActiveSpeaker: (userId: string) => void;
  removeActiveSpeaker: (userId: string) => void;
  micOff: (userId: string) => void;
  micOn: (userId: string) => void;
  roomDeleted: (roomName: string) => void;
  userDisconnect: (userId: string) => void;
  userLeftRoom: (roomName: string, userId: string) => void;

  roomCreated: (roomName: string) => void;
  userJoined: (data: { user: User }) => void;
  userJoinRoom: (
    roomName: string,
    data: {
      id: string;
      name: string;
      image: string;
    }
  ) => void;
  leaveRoom: () => void;
}

export interface SocketData {
  user: User & {
    roomName?: string;
  };
}

export interface SocketWrapper<CTS extends EventsMap, STC extends EventsMap>
  extends Socket<CTS, STC, DefaultEventsMap, SocketData> {
  customOn: CustomOn;
}

export type CustomSocket<
  CTS extends EventsMap = DefaultEventsMap,
  STC extends EventsMap = ServerToClientEvents,
> = SocketWrapper<CTS, STC>;
