import { DataList } from "src/lib/dataTypes/dataList";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { Server } from "socket.io";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import ApiRoomError from "../utils/errors";

const joinRoomSchema = Type.Object({
  roomId: Type.String({ minLength: 1 }),
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

      const room = rooms.get(input.roomId);
      if (!room) {
        throw new SocketError(ApiRoomError.NOT_FOUND);
      }

      const previousPeer = room.peers.get(user.id);
      if (previousPeer) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const socketId = previousPeer.sockets.pop()!;
        const socket = io.sockets.sockets.get(socketId);

        await socket?.leave(input.roomId);
        socket?.emit("leaveRoom");
      }

      socket.join(input.roomId);
      socket.data.user.roomId = input.roomId;

      room.peers.set(user.id, {
        sockets: new DataList([socket.id]),
        transports: {},
        producers: {},
        consumers: new Map(),
        user,
        voiceMuted: true,
      });

      socket.broadcast.to(input.roomId).emit("userJoined", { user });
      if (room.type === "public") {
        socket.broadcast.emit("userJoinRoom", input.roomId, {
          id: user.id,
          name: user.name,
          image: user.image ?? "",
        });
      }

      cb({ data: { success: true } });
    },
  });
}
