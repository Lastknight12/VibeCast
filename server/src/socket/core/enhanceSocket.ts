import { Socket } from "socket.io";
import { DefaultEventsMap, EventsMap } from "socket.io/dist/typed-events";
import { ServerToClientEvents } from "src/types/socket";
import { customOn } from "./features/customOn";

import { User } from "better-auth/*";

export interface SocketData {
  user?: User & {
    roomId?: string;
  };
}

interface SocketWrapper<CTS extends EventsMap, STC extends EventsMap>
  extends Socket<CTS, STC, DefaultEventsMap, SocketData> {
  customOn: typeof customOn;
}

export type CustomSocket = SocketWrapper<
  DefaultEventsMap,
  ServerToClientEvents
>;

export function enhanceSocket(
  _socket: Socket<
    DefaultEventsMap,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  >,
) {
  const socket = _socket as CustomSocket;

  socket.customOn = customOn;

  return socket;
}
