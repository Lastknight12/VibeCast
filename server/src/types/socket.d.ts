import { type Socket } from "socket.io";
import { EventsMap } from "socket.io/dist/typed-events";

export interface SocketData {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null | undefined;
    roomName?: string;
  };
}

export type CustomSocket<
  ClientToServerEvents extends EventsMap = any,
  ServerToClientEvents extends EventsMap = any,
> = Socket<ClientToServerEvents, ServerToClientEvents, any, SocketData>;
