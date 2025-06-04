import { type Socket } from "socket.io";
import { sfuModule } from "./modules/sfu";
import { roomsModule } from "./modules/room";

export function setupSocketRoutes(socket: Socket) {
  sfuModule(socket);
  roomsModule(socket);
}
