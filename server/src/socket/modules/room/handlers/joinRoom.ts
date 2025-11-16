import { DataList } from "src/lib/dataTypes/dataList";
import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { Server } from "socket.io";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../utils/errors";

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
      const { data } = input;
      const { user } = socket.data;

      const room = rooms.get(data.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const previousPeer = room.peers.get(user.id);
      if (previousPeer) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const socketId = previousPeer.sockets.pop()!;
        const socket = io.sockets.sockets.get(socketId);

        await socket?.leave(data.roomId);
        socket?.emit("leaveRoom");
      }

      socket.join(data.roomId);
      socket.data.user.roomId = data.roomId;

      room.peers.set(user.id, {
        sockets: new DataList([socket.id]),
        transports: {},
        producers: {},
        consumers: new Map(),
        user,
        voiceMuted: true,
      });

      socket.broadcast.to(data.roomId).emit("userJoined", { user });
      if (room.type === "public") {
        socket.broadcast.emit("userJoinRoom", data.roomId, {
          id: user.id,
          name: user.name,
          image: user.image ?? "",
        });
      }

      cb({ data: { success: true } });
    },
  });
}
