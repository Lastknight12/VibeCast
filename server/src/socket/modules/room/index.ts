import { User } from "better-auth/types";
import { worker } from "../../../main";
import { rooms } from "../../../lib/roomState";
import { CustomSocket } from "../../../types/socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./type";

export function roomsModule(
  socket: CustomSocket<ClientToServerEvents, ServerToClientEvents>
) {
  socket.on(
    "createRoom",
    async (roomName, roomType: "private" | "public", cb) => {
      if (rooms.has(roomName)) {
        return cb({
          error: "Room already exists",
        });
      }

      const router = await worker.createRouter({
        mediaCodecs: [
          {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
          },
          { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
          { kind: "video", mimeType: "video/H264", clockRate: 90000 },
        ],
      });

      rooms.set(roomName, {
        router,
        peers: new Map(),
        type: roomType,
      });

      if (roomType === "public") {
        socket.broadcast.emit("roomCreated", roomName);
        socket.emit("roomCreated", roomName);
      }

      cb({
        error: null,
      });
    }
  );

  socket.on("joinRoom", (roomName, cb) => {
    if (!rooms.has(roomName)) {
      cb({ error: "no room with id" + roomName + "exist" });
      return;
    }

    const room = rooms.get(roomName);

    socket.join(roomName);
    socket.data.user.roomName = roomName;

    if (room.peers.has(socket.data.user.id)) {
      cb({ error: "Already in room" });
      // just add current socket and skip steps below
      room.peers.get(socket.data.user.id).sockets.add(socket.id);
      return;
    }

    room.peers.set(socket.data.user.id, {
      sockets: new Set([socket.id]),
      transports: {},
      producers: {},
      consumers: new Map(),
      user: {
        id: socket.data.user.id,
        name: socket.data.user.name,
        image: socket.data.user.image,
      },
      voiceMuted: true,
    });

    socket.broadcast
      .to(roomName)
      .emit("userJoined", { user: socket.data.user });

    if (room.type === "public") {
      socket.broadcast.emit("userJoinRoom", roomName, {
        id: socket.data.user.id,
        name: socket.data.user.name,
        image: socket.data.user.image,
      });
    }

    cb({ error: null });
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
    const room = rooms.get(socket.data.user.roomName);

    const peers = new Array<{
      user: Pick<User, "id" | "name" | "image">;
      voiceMuted: boolean;
      producers: { audio?: { id: string }; video?: { id: string } };
    }>();

    for (const [id, data] of room.peers.entries()) {
      if (id === socket.data.user.id) continue;

      peers.push({
        producers: {
          audio: data.producers.audio && { id: data.producers.audio.id },
          video: data.producers.video && {
            id: data.producers.video.id,
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
