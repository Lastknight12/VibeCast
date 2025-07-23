import { User } from "better-auth/types";
import roomModule from "..";
import { ErrorCb, HandlerInput } from "src/socket/core";

export type Data = HandlerInput<{
  cb: (
    result:
      | Parameters<ErrorCb>[0]
      | Record<
          string,
          {
            peers: Pick<User, "id" | "image" | "name">;
          }
        >
  ) => void;
}>;

roomModule.defineSocketHandler({
  event: "getAllRooms",
  config: { expectCb: true },
  handler: (ctx, data: Data) => {
    const { rooms } = ctx;
    const { cb } = data;
    const roomList: Record<string, { peers: Record<string, User> }> = {};

    rooms.forEach((room, id) => {
      if (room.type === "private") {
        return;
      }

      const peers = {};
      room.peers.forEach((peer, id) => {
        peers[id] = {
          id,
          image: peer.user.image,
          name: peer.user.name,
        };
      });

      roomList[id] = {
        peers,
      };
    });

    cb(roomList);
  },
});
