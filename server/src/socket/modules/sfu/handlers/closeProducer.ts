import { Type } from "@sinclair/typebox";
import { closeRelatedConsumers } from "../utils";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/utils/errors";
import { cloudinary } from "src/lib/cloudinary";

const closeProducerSchema = Type.Object({
  type: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "closeProducer",
    config: {
      schema: closeProducerSchema,
      protected: true,
      expectCb: true,
    },
    async handler(input, cb) {
      const { data, context } = input;
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }
      const roomId = user.roomId;

      const room = rooms.get(roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const onConsumerClosed = (consumerId: string) => {
        socket.broadcast.to(roomId).emit("consumerClosed", consumerId);
      };

      switch (data.type) {
        case "video": {
          const videoProducer = peer.producers.screenShare?.video;
          const systemAudioProducer = peer.producers.screenShare?.audio;
          if (!videoProducer) {
            context.logger.error("Video producer not found");
            return;
          }
          videoProducer.close();
          systemAudioProducer?.close();
          peer.producers.screenShare = undefined;

          socket.broadcast.to(roomId).emit("peerClosedProducer", {
            peerId: user.id,
            type: "screenShare",
          });

          closeRelatedConsumers(
            [videoProducer.id, systemAudioProducer?.id].filter(
              Boolean
            ) as string[],
            roomId,
            onConsumerClosed
          );

          cloudinary.api
            .delete_resources_by_prefix(`thumbnails/${user.id}`)
            .catch(context.logger.error);
          break;
        }
        case "audio": {
          const audioProducer = peer.producers.audio;
          if (!audioProducer) {
            context.logger.error(console.log("Audio producer not found"));
            return;
          }
          audioProducer.close();

          socket.broadcast.to(roomId).emit("peerClosedProducer", {
            peerId: user.id,
            type: "audio",
          });

          closeRelatedConsumers([audioProducer.id], roomId, onConsumerClosed);

          peer.producers.audio = undefined;
          break;
        }
      }

      cb({ data: null });
    },
  });
}
