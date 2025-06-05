import { Server, type Socket } from "socket.io";
import { sfuModule } from "./modules/sfu";
import { roomsModule } from "./modules/room";

export function setupSocketRoutes(socket: Socket, io: Server) {
  sfuModule(socket, io);
  roomsModule(socket, io);
}
