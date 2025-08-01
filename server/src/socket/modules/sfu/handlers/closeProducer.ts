import { Type } from "@sinclair/typebox";
import { closeRelatedConsumers } from "../sfu.utils";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../errors";

const closeProducerSchema = Type.Object({
  type: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "closeProducer",
    config: {
      schema: closeProducerSchema,
      protected: true,
    },
    handler(input) {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const onConsumerClosed = (consumerId: string) => {
        socket.broadcast.to(user.roomName!).emit("consumerClosed", consumerId);
      };

      switch (input.type) {
        case "video": {
          const videoProducer = peer.producers.screenShare?.video;
          const systemAudioProducer = peer.producers.screenShare?.audio;
          if (!videoProducer) {
            console.log("Video producer not found");
            return;
          }
          videoProducer.close();
          systemAudioProducer?.close();

          socket.broadcast.to(user.roomName).emit("peerClosedProducer", {
            peerId: user.id,
            type: "screenShare",
          });

          closeRelatedConsumers(
            [videoProducer.id, systemAudioProducer?.id].filter(
              Boolean
            ) as string[],
            user.roomName,
            onConsumerClosed
          );
          peer.producers.screenShare = undefined;
          break;
        }
        case "audio": {
          const audioProducer = peer.producers.audio;
          if (!audioProducer) {
            console.log("Audio producer not found");
            return;
          }
          audioProducer.close();

          socket.broadcast.to(user.roomName).emit("peerClosedProducer", {
            peerId: user.id,
            type: "screenShare",
          });

          closeRelatedConsumers(
            [audioProducer.id],
            user.roomName,
            onConsumerClosed
          );

          peer.producers.audio = undefined;
          break;
        }
      }
    },
  });
}
