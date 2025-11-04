import { DefaultEventsMap, type Socket } from "socket.io";
// TODO
import { ServerToClientEvents, CustomOn } from "src/socket/core";
import { User } from "better-auth/types";
import { User } from "better-auth/types";
import { EventsMap } from "socket.io/dist/typed-events";

export interface EventError {
  event: string;
  error: {
    code: string;
    message: string;
  };
}

type ProducerType = "audio" | "video" | "video_audio";

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
  roomDeleted: (roomId: string) => void;
  userDisconnect: (userId: string) => void;
  userLeftRoom: (roomId: string, userId: string) => void;

  roomCreated: (data: { name: string; id: string }) => void;
  userJoined: (data: { user: User }) => void;
  userJoinRoom: (
    roomId: string,
    data: {
      id: string;
      name: string;
      image: string;
    }
  ) => void;
  leaveRoom: () => void;
  "new-thumbnail": (url: string, peerId: string) => void;
}

export interface SocketData {
  user: User & {
    roomId?: string;
  };
}

export interface SocketWrapper<CTS extends EventsMap, STC extends EventsMap>
  extends Socket<CTS, STC, DefaultEventsMap, SocketData> {
  customOn: CustomOn;
}
