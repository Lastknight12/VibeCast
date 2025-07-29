import { Type } from "@sinclair/typebox";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/types/socket";
import { errors } from "../../shared/errors";

const leaveSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "leave",
    config: {
      schema: leaveSchema,
      protected: true,
    },
    handler: (input) => {
      const { user } = socket.data;
      const room = rooms.get(input.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      room.peers.delete(user.id);
      socket.broadcast.to(input.roomName).emit("userDisconnect", user.id);
      if (room.type === "public") {
        socket.broadcast.emit("userLeftRoom", input.roomName, user.id);
        socket.emit("userLeftRoom", input.roomName, user.id);
      }

      if (room.peers.size === 0) {
        rooms.delete(input.roomName);
        if (room.type === "public") {
          socket.broadcast.emit("roomDeleted", input.roomName);
          socket.emit("roomDeleted", input.roomName);
        }
      }
    },
  });
}
