import { HandlerCallback, SocketError } from "src/socket/core";
import { RoomPeer } from "../types";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { errors } from "../../errors";
import { User } from "better-auth/*";

type Result = Omit<RoomPeer, "user"> & {
  userData: Pick<User, "id" | "name" | "image">;
};

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getRoomPeers",
    config: {
      protected: true,
      expectCb: true,
    },
    handler: (_input, cb: HandlerCallback<Result[]>) => {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.ALREADY_EXISTS);
      }

      const peers = new Array<Result>();

      for (const [id, data] of room.peers.entries()) {
        if (id === socket.data.user.id) continue;

        const videoProducer = data.producers.screenShare?.video;
        const systemAudioProducer = data.producers.screenShare?.audio;
        const audioProducer = data.producers.audio;

        peers.push({
          producers: {
            audio: audioProducer?.id,
            screenShare: videoProducer && {
              video: videoProducer.id,
              audio: systemAudioProducer?.id,
            },
          },
          userData: {
            id: data.user.id,
            name: data.user.name,
            image: data.user.image,
          },
          voiceMuted: data.voiceMuted,
        });
      }

      cb({ data: peers });
    },
  });
}
