import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import { errors } from "../../errors";
import { cloudinary } from "src/lib/cloudinary";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "leave",
    config: {
      protected: true,
    },
    async handler() {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      room.peers.delete(user.id);
      socket.broadcast.to(user.roomId).emit("userDisconnect", user.id);
      if (room.type === "public") {
        socket.broadcast.emit("userLeftRoom", user.roomId, user.id);
        socket.emit("userLeftRoom", user.roomId, user.id);
      }

      if (room.peers.size === 0) {
        rooms.delete(user.roomId);
        if (room.type === "public") {
          socket.broadcast.emit("roomDeleted", user.roomId);
          socket.emit("roomDeleted", user.roomId);
        }
      }

      await await cloudinary.api.delete_resources_by_prefix(
        `thumbnails/${user.roomId}`
      );
      await cloudinary.api.delete_folder(`thumbnails/${user.roomId}`);
    },
  });
}
