import { User } from "better-auth/types";
import { rooms } from "src/lib/roomState";
import { CustomSocket } from "src/types/socket";

type Result = Record<string, { peers: Record<string, User> }>;

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getAllRooms",
    handler: (): Result => {
      const roomList: Result = {};

      rooms.forEach((room, id) => {
        if (room.type === "private") {
          return;
        }

        const peers = {};
        room.peers.forEach((peer, id) => {
          peers[id] = {
            id,
            image: peer.user.image,
            name: peer.user.name,
          };
        });

        roomList[id] = {
          peers,
        };
      });

      return roomList;
    },
  });
}
