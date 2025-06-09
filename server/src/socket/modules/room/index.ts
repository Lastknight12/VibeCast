import { User } from "better-auth/types";
import { rooms } from "../../../lib/roomState";
import { CustomSocket } from "../../../types/socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./type";
import { type Server } from "socket.io";
import { PeersMap } from "../../../lib/peersMap";
import { Stack } from "../../../lib/stack";
import { getMediasoupWorker } from "../../../lib/worker";

export function roomsModule(
  socket: CustomSocket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  socket.on(
    "createRoom",
    async (roomName, roomType: "private" | "public", cb) => {
      if (rooms.has(roomName)) {
        return cb({
          error: "Room already exists",
        });
      }

      const worker = getMediasoupWorker();

      const router = await worker.createRouter({
        mediaCodecs: [
          {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
          },
          { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
        ],
      });

      rooms.set(roomName, {
        router,
        peers: new PeersMap(),
        type: roomType,
      });

      if (roomType === "public") {
        socket.broadcast.emit("roomCreated", roomName);
        socket.emit("roomCreated", roomName);
      }

      cb({
        error: undefined,
      });
    }
  );

  socket.on("joinRoom", (roomName, cb) => {
    const { user } = socket.data;

    const room = rooms.get(roomName);
    if (!room) {
      cb({ error: `no room with name '${roomName}' exist` });
      return;
    }

    const peer = room.peers.get(socket.data.user.id);

    socket.join(roomName);
    socket.data.user.roomName = roomName;

    if (peer) {
      const peerSocket = io.sockets.sockets.get(peer.sockets.peek()!);
      if (!peerSocket) {
        cb({ error: "Server error" });
        return;
      }

      peer.sockets.pop();
      peer.sockets.add(socket.id);
      peerSocket.leave(roomName);
      peerSocket.emit("leaveRoom");
      peer.cleanupPeerConnection();
    } else {
      room.peers.set(user.id, {
        sockets: new Stack([socket.id]),
        transports: {},
        producers: {},
        consumers: new Map(),
        user: {
          id: user.id,
          name: user.name,
          image: user.image,
        },
        voiceMuted: true,
      });

      socket.broadcast.to(roomName).emit("userJoined", { user });

      if (room.type === "public") {
        socket.broadcast.emit("userJoinRoom", roomName, {
          id: user.id,
          name: user.name,
          image: user.image!,
        });
      }
    }

    cb({ error: undefined });
  });

  socket.on("getAllRooms", (cb) => {
    const roomList: Record<string, { peers: Record<string, User> }> = {};

    rooms.forEach((room, id) => {
      if (room.type === "private") {
        return;
      }

      const peers = {};

      room.peers.forEach((peer, id) => {
        peers[id] = peer.user;
      });

      roomList[id] = {
        peers: peers,
      };
    });

    cb(roomList);
  });

  socket.on("getRoomPeers", (cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      return cb({ error: "Room not found" });
    }

    const peers = new Array<{
      user: Pick<User, "id" | "name" | "image">;
      voiceMuted: boolean;
      producers: {
        audio?: { id: string };
        screenShare?: {
          video: { id: string };
          audio?: { id: string };
        };
      };
    }>();

    for (const [id, data] of room.peers.entries()) {
      if (id === socket.data.user.id) continue;

      const videoProducer = data.producers.screenShare?.video;
      const systemAudioProducer = data.producers.screenShare?.audio;
      const audioProducer = data.producers.audio;

      peers.push({
        producers: {
          audio: audioProducer && { id: audioProducer.id },
          screenShare: videoProducer && {
            video: { id: videoProducer.id },
            audio: systemAudioProducer && { id: systemAudioProducer.id },
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
  });
}
