import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { HandlerInput } from "src/socket/core";

const leaveSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
});

type Data = HandlerInput<{
  payload: Static<typeof leaveSchema>;
}>;

sfuModule.defineSocketHandler({
  event: "leave",
  config: {
    schema: leaveSchema,
    protected: true,
  },
  handler: (ctx, params: Data) => {
    const { socket, rooms } = ctx;
    const { payload } = params;

    const { user } = socket.data;
    const room = rooms.get(payload.roomName);
    if (!room) {
      console.log(`no room exist with name ${payload.roomName}`);
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    room.peers.delete(user.id);
    socket.broadcast.to(payload.roomName).emit("userDisconnect", user.id);
    if (room.type === "public") {
      socket.broadcast.emit("userLeftRoom", payload.roomName, user.id);
      socket.emit("userLeftRoom", payload.roomName, user.id);
    }

    if (room.peers.size === 0) {
      rooms.delete(payload.roomName);
      if (room.type === "public") {
        socket.broadcast.emit("roomDeleted", payload.roomName);
        socket.emit("roomDeleted", payload.roomName);
      }
    }
  },
});
