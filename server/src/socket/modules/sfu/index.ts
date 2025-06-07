import { Router } from "mediasoup/node/lib/types";
import { rooms } from "../../../lib/roomState";
import { CustomSocket } from "../../../types/socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { type Server } from "socket.io";

const createWebRtcTransport = async (router: Router) => {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: "192.168.0.101" }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
  return transport;
};

function getRoomRouter(roomName: string): Router | null {
  const room = rooms.get(roomName);
  if (!room) {
    return null;
  }

  return room.router;
}

export function sfuModule(
  socket: CustomSocket<ClientToServerEvents, ServerToClientEvents>,
  _: Server<ClientToServerEvents, ServerToClientEvents>
) {
  socket.on("getRTPCapabilities", (cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const router = getRoomRouter(user.roomName);
    if (!router) {
      return cb({ error: "Room not found" });
    }

    cb(router.rtpCapabilities);
  });

  socket.on("createTransport", async (type, cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      return cb({ error: "Room not found" });
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log(`Peer not found in room ${user.roomName}`);
      return;
    }

    try {
      const transport = await createWebRtcTransport(room.router);
      if (type === "send") {
        peer.transports.send = transport;
      } else {
        peer.transports.recv = transport;
      }

      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      });
    } catch (error) {
      console.log(`Error creating transport: ${error}`);
      cb({ error: "Error creating transport" });
    }
  });

  socket.on("connectTransport", async ({ dtlsParameters, type }, cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      cb({ error: "User not joined room" });
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });

    switch (type) {
      case "send": {
        if (!peer.transports.send) {
          cb({ error: "Transport not found" });
          return;
        }

        await peer.transports.send.connect({ dtlsParameters });
        cb({ connected: true });
        return;
      }

      case "recv": {
        if (!peer.transports.recv) {
          cb({ error: "Transport not found" });
          return;
        }

        await peer.transports.recv.connect({ dtlsParameters });
        cb({ connected: true });
        return;
      }
    }
  });

  socket.on("produce", async ({ kind, rtpParameters, type }, cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });
    if (!peer.transports.send) return cb({ error: "Transport not found" });

    const producer = await peer.transports.send.produce({
      kind,
      rtpParameters,
      appData: {
        userId: user.id,
      },
    });

    if (type === "video") {
      peer.producers.video = producer;
    } else {
      peer.producers.audio = producer;
    }

    cb({ id: producer.id });

    socket.broadcast
      .to(user.roomName)
      .emit("newProducer", producer.id, user.id, type);
  });

  socket.on("closeVideoProducer", () => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      console.log("Room not found");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("Peer not found");
      return;
    }
    if (!peer.producers.video) {
      console.log("Video producer not found");
      return;
    }

    peer.producers.video.close();

    const videoProducerId = peer.producers.video.id;

    for (const [_, peer] of room.peers) {
      const consumerEntries = Array.from(peer.consumers.entries());

      for (const [consumerId, consumer] of consumerEntries) {
        if (consumer.producerId === videoProducerId) {
          consumer.close();
          peer.consumers.delete(consumerId);

          socket.broadcast
            .to(user.roomName)
            .emit("consumerClosed", consumerId, user.id, consumer.kind);
        }
      }
    }
    peer.producers.video = undefined;
  });

  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });
    if (!peer.transports.recv) return cb({ error: "Transport not found" });

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return cb({ error: "Cannot consume" });
    }

    const consumer = await peer.transports.recv.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    peer.consumers.set(consumer.id, consumer);

    cb({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  socket.on("consumerReady", (consumerId: string) => {
    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }
    if (!peer.consumers.has(consumerId)) {
      console.log("no consumer founded in peer");
      return;
    }

    peer.consumers.get(consumerId)!.resume();
  });

  socket.on("activeSpeaker", ({ type }: { type: "add" | "remove" }) => {
    const { user } = socket.data;

    socket.broadcast.emit(
      `${type === "add" ? "add" : "remove"}ActiveSpeaker`,
      user.id
    );
  });

  socket.on("micOff", (roomName) => {
    const { user } = socket.data;

    const room = rooms.get(roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = true;

    socket.broadcast.to(roomName).emit("micOff", user.id);
  });

  socket.on("micOn", (roomName) => {
    const { user } = socket.data;

    const room = rooms.get(roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = false;

    socket.broadcast.to(roomName).emit("micOn", user.id);
  });

  socket.on("leave", (roomName) => {
    console.log("emit leave");
    const { user } = socket.data;

    const room = rooms.get(roomName);
    if (!room) {
      console.log("event 'leave':", `no room exist with name ${roomName}`);
      return;
    }

    const peer = room.peers.get(user.id);

    peer?.sockets.delete(socket.id);

    if (peer?.sockets.size() === 0) {
      peer.cleanupPeerConnection();

      room.peers.delete(user.id);

      socket.broadcast.to(roomName).emit("userDisconnect", user.id);
      socket.broadcast.emit("userLeftRoom", roomName, user.id);
      socket.emit("userLeftRoom", roomName, user.id);
    }

    if (room.peers.size === 0) {
      rooms.delete(roomName);

      if (room.type === "public") {
        socket.broadcast.emit("roomDeleted", roomName);
        socket.emit("roomDeleted", roomName);
      }
    }
  });
}
