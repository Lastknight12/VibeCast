import { DefaultEventsMap, type Socket } from "socket.io";
import { ServerToClientEvents, CustomOn } from "src/socket/core";
import { User } from "better-auth/*";

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
