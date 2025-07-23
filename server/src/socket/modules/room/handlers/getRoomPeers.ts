import { ErrorCb, HandlerInput } from "src/socket/core";
import roomModule from "..";
import { RoomPeer } from "../types";

type Data = HandlerInput<{
  cb: (peers: RoomPeer[] | Parameters<ErrorCb>[0]) => void;
}>;

roomModule.defineSocketHandler({
  event: "getRoomPeers",
  config: {
    expectCb: true,
  },
  handler: (ctx, data: Data) => {
    const { socket, rooms } = ctx;
    const { cb } = data;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      return cb({ error: "Room not found" });
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

    cb(peers);
  },
});
