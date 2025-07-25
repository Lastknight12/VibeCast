import { DataList } from "src/lib/dataList";

import { Type } from "@sinclair/typebox";
import roomModule from "..";
import { ErrorCb, HandlerInput } from "src/socket/core";

const joinRoomSchema = Type.Object({
  roomName: Type.String({ minLength: 1 }),
});

type Data = HandlerInput<{ payload: { roomName: string }; cb: ErrorCb }>;

roomModule.defineSocketHandler({
  event: "joinRoom",
  config: {
    schema: joinRoomSchema,
    expectCb: true,
  },
  handler: async (ctx, data: Data) => {
    const { socket, io, rooms } = ctx;
    const {
      payload: { roomName },
      cb,
    } = data;

    const { user } = socket.data;

    const room = rooms.get(roomName);
    if (!room) {
      cb({ error: `no room with name '${roomName}' exist` });
      return;
    }

    const previousPeer = room.peers.get(user.id);
    if (previousPeer) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const socketId = previousPeer.sockets.pop()!;
      const socket = io.sockets.sockets.get(socketId);

      await socket?.leave(roomName);
      socket?.emit("leaveRoom");
    }

    socket.join(roomName);
    socket.data.user.roomName = roomName;

    room.peers.set(user.id, {
      sockets: new DataList([socket.id]),
      transports: {},
      producers: {},
      consumers: new Map(),
      user,
      voiceMuted: true,
    });

    socket.broadcast.to(roomName).emit("userJoined", { user });
    if (room.type === "public") {
      socket.broadcast.emit("userJoinRoom", roomName, {
        id: user.id,
        name: user.name,
        image: user.image ?? "",
      });
    }

    cb({ error: undefined });
  },
});
