import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "switchMic",
    config: {
      protected: true,
    },
    handler: () => {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomError.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      peer.voiceMuted = !peer.voiceMuted;
      const event = peer.voiceMuted ? "micOff" : "micOn";
      socket.broadcast.to(user.roomId).emit(event, user.id);
    },
  });
}
