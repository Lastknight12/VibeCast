import { Type } from "@sinclair/typebox";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/types/socket";
import { errors } from "../../errors";

const switchMicSchema = Type.Object({
  muted: Type.Boolean(),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "switchMic",
    config: {
      schema: switchMicSchema,
      protected: true,
    },
    handler: (input) => {
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

      peer.voiceMuted = input.muted;
      const event = input.muted ? "micOff" : "micOn";
      socket.broadcast.to(user.roomName).emit(event, user.id);
    },
  });
}
