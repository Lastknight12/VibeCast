import { CustomSocket, HandlerCallback, SocketError } from "src/socket/core";
import { User } from "better-auth/types";
import { rooms } from "src/state/roomState";
import { ApiRoomErrors } from "../errors";
import { thumbnails } from "./uploadThumbnail";

interface RoomPeer {
  user: Pick<User, "id" | "name" | "image">;
  producers: {
    audio?: string;
    screenShare?: { thumbnail?: string; video: string; audio?: string };
  };
  voiceMuted: boolean;
}

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
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
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
              thumbnail: thumbnails.get(id),
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
