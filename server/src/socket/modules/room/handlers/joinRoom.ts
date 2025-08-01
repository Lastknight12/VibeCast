import { DataList } from "src/lib/dataList";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/types/socket";
import { Server } from "socket.io";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../errors";

const joinRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket, io: Server) {
  socket.customOn({
    event: "joinRoom",
    config: {
      schema: joinRoomSchema,
      protected: true,
      expectCb: true,
    },
    handler: async (input, cb) => {
      const { user } = socket.data;

      const room = rooms.get(input.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const previousPeer = room.peers.get(user.id);
      if (previousPeer) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const socketId = previousPeer.sockets.pop()!;
        const socket = io.sockets.sockets.get(socketId);

        await socket?.leave(input.roomName);
        socket?.emit("leaveRoom");
      }

      socket.join(input.roomName);
      socket.data.user.roomName = input.roomName;

      room.peers.set(user.id, {
        sockets: new DataList([socket.id]),
        transports: {},
        producers: {},
        consumers: new Map(),
        user,
        voiceMuted: true,
      });

      socket.broadcast.to(input.roomName).emit("userJoined", { user });
      if (room.type === "public") {
        socket.broadcast.emit("userJoinRoom", input.roomName, {
          id: user.id,
          name: user.name,
          image: user.image ?? "",
        });
      }

      cb({ data: { success: true } });
    },
  });
}
