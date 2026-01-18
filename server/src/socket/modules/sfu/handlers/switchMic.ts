import { rooms } from "src/state/roomState";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "switchMic",
    config: {
      protected: true,
    },
    handler: (input) => {
      const { user } = input.context;
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

      peer.voiceMuted = !peer.voiceMuted;
      const event = peer.voiceMuted ? "micOff" : "micOn";
      socket.broadcast.to(user.roomId).emit(event, { userId: user.id });
    },
  });
}
