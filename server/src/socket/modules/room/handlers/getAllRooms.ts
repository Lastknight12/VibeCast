import { User } from "better-auth/types";
import { rooms } from "src/state/roomState";
import { CustomSocket, HandlerCallback } from "src/socket/core";

type Result = Record<string, { name: string; peers: Record<string, User> }>;

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getAllRooms",
    config: {
      expectCb: true,
    },
    handler: (_input, cb: HandlerCallback<Result>) => {
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
          name: room.name,
          peers,
        };
      });

      cb({ data: roomList });
    },
  });
}
