import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { HandlerInput } from "src/socket/core/defineModuleFactory";

const switchMicSchema = Type.Object({
  muted: Type.Boolean(),
});

type Data = HandlerInput<{ payload: Static<typeof switchMicSchema> }>;

sfuModule.defineSocketHandler({
  event: "switchMic",
  config: {
    schema: switchMicSchema,
  },
  handler: (ctx, data: Data) => {
    const { socket, rooms } = ctx;
    const { payload } = data;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = payload.muted;
    const event = payload.muted ? "micOff" : "micOn";
    socket.broadcast.to(user.roomName).emit(event, user.id);
  },
});
