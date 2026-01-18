import { User } from "better-auth/types";
import { EventError } from "src/socket/core";
import { Message } from "src/state/chatMessages";

type ProducerType = "audio" | "video" | "video_audio";

export interface ServerToClientEvents {
  error: (data: EventError) => void;
  newProducer: (data: {
    producerId: string;
    userId: string;
    type: ProducerType;
  }) => void;
  consumerClosed: (data: { consumerId: string }) => void;
  userClosedProducer: (data: {
    userId: string;
    type: "screenShare" | "audio";
  }) => void;
  micOff: (data: { userId: string }) => void;
  micOn: (data: { userId: string }) => void;
  roomDeleted: (data: { roomId: string }) => void;
  userDisconnected: (data: { userId: string }) => void;
  userLeftRoom: (data: { roomId: string; userId: string }) => void;
  roomCreated: (data: { name: string; id: string }) => void;
  userJoined: (data: { user: User }) => void;
  userJoinRoom: (data: {
    roomId: string;
    userData: {
      id: string;
      name: string;
      image: string;
    };
  }) => void;
  leaveRoom: () => void;
  "new-thumbnail": (data: { url: string; userId: string }) => void;
  newMessage: (data: Message) => void;
}
