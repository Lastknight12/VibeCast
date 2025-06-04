import { type Socket } from "socket.io";

export interface SocketData {
  user?: {
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
  ClientToServerEvents = any,
  ServerToClientEvents = any,
> = Socket<ClientToServerEvents, ServerToClientEvents, any, SocketData>;
