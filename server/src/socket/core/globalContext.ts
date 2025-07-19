import { Server } from "socket.io";
import { rooms } from "src/lib/roomState";
import { CustomSocket } from "src/types/socket";

export interface GlobalContext {
  socket: CustomSocket;
  io: Server;
  rooms: typeof rooms;
}

export function createGlobalContext(
  data: Pick<GlobalContext, "socket" | "io">
): GlobalContext {
  return {
    ...data,
    rooms,
  };
}
