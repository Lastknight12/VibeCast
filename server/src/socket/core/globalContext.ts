import { Server } from "socket.io";
import { rooms } from "src/lib/roomState";
import { CustomSocket } from "src/types/socket";

export type GlobalContext = {
  socket: CustomSocket;
  io: Server;
  rooms: typeof rooms;
};

export function createGlobalContext(
  socket: CustomSocket,
  io: Server
): GlobalContext {
  return {
    socket,
    io,
    rooms,
  };
}
