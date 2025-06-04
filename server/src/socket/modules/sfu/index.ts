import { Router } from "mediasoup/node/lib/types";
import { rooms } from "../../../lib/roomState";
import { CustomSocket } from "../../../types/socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

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
  socket: CustomSocket<ClientToServerEvents, ServerToClientEvents>
) {
  socket.on("getRTPCapabilities", (cb) => {
    const router = getRoomRouter(socket.data.user.roomName);

    if (!router) {
      return cb({ error: "Room not found" });
    }

    cb(router.rtpCapabilities);
  });

  socket.on("createTransport", async (type, cb) => {
    const room = rooms.get(socket.data.user.roomName);
    if (!room) {
      return cb({ error: "Room not found" });
    }

    const peer = room.peers.get(socket.data.user.id);

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
      console.error("Error creatingtransport:", error);
      cb({ error: error.message });
    }
  });

  socket.on("connectTransport", async ({ dtlsParameters, type }, cb) => {
    const room = rooms.get(socket.data.user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(socket.data.user.id);
    if (!peer) return cb({ error: "Peer not found" });

    if (type === "send") {
      await peer.transports.send.connect({ dtlsParameters });
    } else {
      await peer.transports.recv.connect({ dtlsParameters });
    }

    cb({ connected: true });
  });

  socket.on("produce", async ({ kind, rtpParameters, type }, cb) => {
    const room = rooms.get(socket.data.user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(socket.data.user.id);
    if (!peer) return cb({ error: "Peer not found" });

    const producer = await peer.transports.send.produce({
      kind,
      rtpParameters,
      appData: {
        userId: socket.data.user.id,
      },
    });

    if (type === "video") {
      peer.producers.video = producer;
    } else {
      peer.producers.audio = producer;
    }

    cb({ id: producer.id });

    socket.broadcast
      .to(socket.data.user.roomName)
      .emit("newProducer", producer.id, socket.data.user.id, type);
  });

  socket.on("closeVideoProducer", () => {
    const room = rooms.get(socket.data.user.roomName);
    const peer = room.peers.get(socket.data.user.id);

    peer.producers.video.close();

    const videoProducerId = peer.producers.video.id;

    for (const [_, peer] of room.peers) {
      const consumerEntries = Array.from(peer.consumers.entries());

      for (const [consumerId, consumer] of consumerEntries) {
        if (consumer.producerId === videoProducerId) {
          consumer.close();
          peer.consumers.delete(consumerId);

          socket.broadcast
            .to(socket.data.user.roomName)
            .emit(
              "consumerClosed",
              consumerId,
              socket.data.user.id,
              consumer.kind
            );
        }
      }
    }
    peer.producers.video = null;
  });

  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const room = rooms.get(socket.data.user.roomName);
    if (!room) return cb({ error: "Room not found" });
    const peer = room.peers.get(socket.data.user.id);
    if (!peer) return cb({ error: "Peer not found" });

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return cb({ error: "Cannot consume" });
    }

    const consumer = await peer.transports.recv.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    rooms
      .get(socket.data.user.roomName)
      .peers.get(socket.data.user.id)
      .consumers.set(consumer.id, consumer);

    peer.consumers.set(consumer.id, consumer);
    cb({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  socket.on("consumerReady", (consumerId: string) => {
    const room = rooms.get(socket.data.user.roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    room.peers.get(socket.data.user.id).consumers.get(consumerId).resume();
  });

  socket.on("activeSpeaker", ({ type }: { type: "add" | "remove" }) => {
    socket.broadcast.emit(
      `${type === "add" ? "add" : "remove"}ActiveSpeaker`,
      socket.data.user.id
    );
  });

  socket.on("micOff", (roomName) => {
    const room = rooms.get(roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(socket.data.user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = true;

    socket.broadcast.to(roomName).emit("micOff", socket.data.user.id);
  });

  socket.on("micOn", (roomName) => {
    const room = rooms.get(roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(socket.data.user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = false;

    socket.broadcast.to(roomName).emit("micOn", socket.data.user.id);
  });

  socket.on("leave", (roomName) => {
    if (!rooms.has(roomName)) {
      console.log("no room exist with name " + roomName);
      return;
    }

    const room = rooms.get(roomName);

    const peer = room.peers.get(socket.data.user.id);
    if (!peer) {
      console.log("no peer founded");
      return;
    }

    peer.sockets.delete(socket.id);

    if (peer.sockets.size === 0) {
      if (peer.transports.send) peer.transports.send.close();
      if (peer.transports.recv) peer.transports.recv.close();

      peer.producers.audio?.close();
      peer.producers.video?.close();

      for (const c of peer.consumers.values()) c.close();

      room.peers.delete(socket.data.user.id);
      if (room.peers.size === 0) {
        rooms.delete(roomName);

        if (room.type === "public") {
          socket.broadcast.emit("roomDeleted", roomName);
          socket.emit("roomDeleted", roomName);
        }
      }

      socket.broadcast.to(roomName).emit("userDisconnect", socket.data.user.id);
      socket.broadcast.emit("userLeftRoom", roomName, socket.data.user.id);
      socket.emit("userLeftRoom", roomName, socket.data.user.id);
    }
  });
}
