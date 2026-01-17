import { rooms } from "src/state/roomState";
import { CustomSocket, HandlerCallback } from "src/socket/core";

interface Result {
  id: string;
  name: string;
  peers: {
    id: string;
    image: string;
    name: string;
  }[];
}

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getAllRooms",
    config: {
      expectCb: true,
    },
    handler: (_input, cb: HandlerCallback<Result[]>) => {
      const roomsList = rooms.getAll("public");

      const formatedList: Result[] = [];
      roomsList.forEach((room) => {
        if (room.type === "private") {
          return;
        }

        const peers: Result["peers"] = [];
        room.peers.forEach((peer, id) => {
          peers.push({
            id,
            image: peer.user.image as string,
            name: peer.user.name,
          });
        });

        formatedList.push({
          id: room.id,
          name: room.name,
          peers,
        });
      });

      cb({ data: formatedList });
    },
  });
}
