import { DataList } from "src/lib/dataTypes/dataList";
import { Type } from "@sinclair/typebox";
import { Server } from "socket.io";
import { rooms } from "src/state/roomState";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../errors";

const joinRoomSchema = Type.Object({
  roomId: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket, io: Server) {
  socket.customOn({
    event: "joinRoom",
    config: {
      schema: joinRoomSchema,
      protected: true,
    },
    handler: async (input, cb) => {
      const { data } = input;
      const { user } = input.context;

      const room = rooms.get(data.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const previousPeer = room.peers.get(user.id);
      if (previousPeer) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const socketId = previousPeer.sockets.pop()!;
        const pSocket = io.sockets.sockets.get(socketId) as CustomSocket;

        await pSocket?.leave(data.roomId);
        pSocket.data.user.roomId = undefined;
        pSocket?.emit("leaveRoom");
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
        socket.broadcast.emit("userJoinRoom", {
          roomId: data.roomId,
          userData: {
            id: user.id,
            name: user.name,
            image: user.image ?? "",
          },
        });
      }

      cb({ data: { success: true } });
    },
  });
}
