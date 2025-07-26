import { HandlerInput } from "src/socket/core";
import sfuModule from "..";
import { Static, Type } from "@sinclair/typebox";

const consumerReadySchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

type Data = HandlerInput<{
  payload: Static<typeof consumerReadySchema>;
}>;

sfuModule.defineSocketHandler({
  event: "consumerReady",
  config: {
    schema: consumerReadySchema,
    protected: true,
  },
  handler: (ctx, params: Data) => {
    const { socket, rooms } = ctx;
    const { payload } = params;

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

    const peerConsumer = peer.consumers.get(payload.id);
    if (!peerConsumer) {
      console.log("no consumer founded");
      return;
    }

    peerConsumer.resume();
  },
});
