import { SocketError } from "src/socket/core";
import { RoomPeer } from "../types";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { errors } from "../../shared/errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getRoomPeers",
    config: {
      protected: true,
    },
    handler: (): RoomPeer[] => {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.ALREADY_EXISTS);
      }

      const peers = new Array<RoomPeer>();

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
          user: {
            id: data.user.id,
            name: data.user.name,
            image: data.user.image,
          },
          voiceMuted: data.voiceMuted,
        });
      }

      return peers;
    },
  });
}
