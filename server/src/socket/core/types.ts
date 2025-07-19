import { ProducerType } from "mediasoup/node/lib/types";
import { HandlerInput, HandlerMeta } from "./defineModuleFactory";
import { GlobalContext } from "./globalContext";
import { User } from "better-auth/types";

export interface EventError {
  event: string;
  details:
    | Error
    | {
        path: string;
        keyword: string;
        message: string;
      }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DefaultHandlerCb = (...args: any[]) => void;

type ErrorCb = (data: { error?: string }) => void;

interface ServerToClientEvents {
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

export {
  HandlerInput,
  HandlerMeta,
  ErrorCb,
  GlobalContext,
  ServerToClientEvents,
};
