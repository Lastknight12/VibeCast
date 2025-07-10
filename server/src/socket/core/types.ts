import { ProducerType } from "mediasoup/node/lib/types";
import {
  HandlerInput,
  SocketHandlerMeta,
  ErrorCb,
} from "./defineModuleFactory";
import { GlobalContext } from "./globalContext";
import { User } from "better-auth/types";

export interface EventError {
  event: string;
  details: {
    path: string;
    keyword: string;
    message: string;
  };
}

interface ServerToClientEvents {
  error: (payload: { event: string; error: Error }) => void;
  newProducer: (producerId: string, userId: string, type: ProducerType) => void;
  consumerClosed: (consumerId: string) => void;
  peerClosedProducer: (data: {
    peerId: string;
    type: "screenShare" | "audio";
  }) => {};
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

export {
  HandlerInput,
  SocketHandlerMeta,
  ErrorCb,
  GlobalContext,
  ServerToClientEvents,
};
