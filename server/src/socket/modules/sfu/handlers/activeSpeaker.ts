import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { HandlerInput } from "src/socket/core/types";

const activeSpeakerSchema = Type.Object({
  type: Type.Union([Type.Literal("add"), Type.Literal("remove")]),
});

type Data = HandlerInput<{
  payload: Static<typeof activeSpeakerSchema>;
}>;

sfuModule.defineSocketHandler({
  event: "activeSpeaker",
  config: {
    schema: activeSpeakerSchema,
  },
  handler: (ctx, params: Data) => {
    const { socket } = ctx;
    const { payload } = params;
    const { user } = socket.data;

    socket.broadcast
      .to(user.roomName!)
      .emit(
        `${payload.type === "add" ? "add" : "remove"}ActiveSpeaker`,
        user.id
      );
  },
});
