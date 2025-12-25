import { rooms } from "src/state/roomState";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../utils/errors";
import { leaveRoom } from "../utils";
import { Server } from "socket.io";

export default function (socket: CustomSocket, io: Server) {
  socket.customOn({
    event: "leave",
    config: {
      protected: true,
    },
    async handler() {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const roomId = user.roomId;
      await leaveRoom(io, { id: user.id, roomId, socket });
    },
  });
}
