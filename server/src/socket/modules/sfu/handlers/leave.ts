import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/types/socket";
import { errors } from "../../errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "leave",
    config: {
      protected: true,
    },
    handler: () => {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      room.peers.delete(user.id);
      socket.broadcast.to(user.roomName).emit("userDisconnect", user.id);
      if (room.type === "public") {
        socket.broadcast.emit("userLeftRoom", user.roomName, user.id);
        socket.emit("userLeftRoom", user.roomName, user.id);
      }

      if (room.peers.size === 0) {
        rooms.delete(user.roomName);
        if (room.type === "public") {
          socket.broadcast.emit("roomDeleted", user.roomName);
          socket.emit("roomDeleted", user.roomName);
        }
      }
    },
  });
}
