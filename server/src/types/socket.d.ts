import { DefaultEventsMap, type Socket } from "socket.io";
import { ServerToClientEvents } from "src/socket/core/types";
import { CustomOn } from "src/socket/core/enhanceSocket";
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
