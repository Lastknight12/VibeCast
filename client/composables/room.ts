import type { User } from "better-auth/types";
import type { Producer } from "mediasoup-client/types";

export function useRoom(roomName: string, mediaConn: mediasoupConn) {
  const socket = useSocket();

  const localVideo = ref<HTMLVideoElement | null>(null);
  const localStream = ref<MediaStream | null>(null);
  const localPinnedStream = ref<{ stream: MediaStream; peerId: string } | null>(
    null
  );
  const isSpeaking = ref<boolean>(false);
  const activeSpeakers = ref<Set<string>>(new Set());
  const muted = ref(mediaConn.muted);

  const joinRoomErrorMessage = ref<string | null>(null);

  const disconnected = ref<boolean>(false);

  const peers = ref<
    Map<
      string,
      {
        stream: {
          audio?: MediaStream | null;
          screenShare?: {
            video: MediaStream;
            audio?: MediaStream | null;
          };
        };
        voiceMuted: boolean;
        userData: User;
      }
    >
  >(new Map());

  const registerSocketListeners = () => {
    socket.on("userJoined", handleUserJoin);
    socket.on("userDisconnect", handleUserDisconnect);

    socket.on("newProducer", handleNewProducer);
    socket.on("consumerClosed", handleConsumerClosed);
    socket.on("peerClosedProducer", handlePeerClosedProducer);

    socket.on("micOff", handleUserMuted);
    socket.on("micOn", handleUserUnMuted);

    socket.on("addActiveSpeaker", handleAddSpeaker);
    socket.on("removeActiveSpeaker", handleRemoveSpeaker);

    socket.on("leaveRoom", handleLeaveRoom);
  };

  const removeSocketListeners = () => {
    socket.off("userJoined", handleUserJoin);
    socket.off("userDisconnect", handleUserDisconnect);

    socket.off("newProducer", handleNewProducer);
    socket.off("consumerClosed", handleConsumerClosed);
    socket.off("peerClosedProducer", handlePeerClosedProducer);

    socket.off("micOff", handleUserMuted);
    socket.off("micOn", handleUserUnMuted);

    socket.off("addActiveSpeaker", handleAddSpeaker);
    socket.off("removeActiveSpeaker", handleRemoveSpeaker);

    socket.off("leaveRoom", handleLeaveRoom);
  };

  const switchLocalPinStream = (peerId: string, stream: MediaStream) => {
    if (!localPinnedStream.value) {
      localPinnedStream.value = { stream, peerId };
    } else {
      localPinnedStream.value = null;
    }
  };

  const handleLeaveRoom = () => {
    mediaConn.close();
    disconnected.value = true;
  };

  const handleAddSpeaker = (userId: string) => {
    activeSpeakers.value.add(userId);
  };

  const handleRemoveSpeaker = (userId: string) => {
    activeSpeakers.value.delete(userId);
  };

  const handleUserJoin = (data: { user: User }) => {
    peers.value.set(data.user.id, {
      stream: {},
      voiceMuted: true,
      userData: data.user,
    });
  };

  const handleUserMuted = (id: string) => {
    const peer = peers.value.get(id);
    if (peer) {
      peer.voiceMuted = true;
    }
  };

  const handleUserUnMuted = (id: string) => {
    const peer = peers.value.get(id);
    if (peer) {
      peer.voiceMuted = false;
    }
  };

  const handleUserDisconnect = (userId: string) => {
    peers.value.delete(userId);
  };

  const handleNewProducer = async (
    producerId: string,
    userId: string,
    type: "video" | "audio" | "system_audio"
  ) => {
    const stream = await mediaConn.consume(producerId);

    if (!stream) {
      console.log("no stream");
      return;
    }

    const peer = peers.value.get(userId);
    if (!peer) {
      console.log("peer not founded");
      return;
    }

    switch (type) {
      case "video": {
        peer.stream.screenShare = { video: stream };
        break;
      }
      case "audio": {
        peer.stream.audio = stream;
        break;
      }
      case "system_audio": {
        peer.stream.screenShare!.audio = stream;
        break;
      }
    }
  };

  const handleConsumerClosed = (consumerId: string) => {
    mediaConn.closeConsumer(consumerId);
  };

  const switchScreenShare = async () => {
    if (!localStream.value) {
      const stream = await mediaConn.getMediaStream();

      localStream.value = new MediaStream(stream.getVideoTracks()); // only provide video stream, not audio

      await mediaConn.produce("video");
      if (stream.getAudioTracks().length > 0) {
        await mediaConn.produce("system_audio");
      }

      localStream.value!.getVideoTracks()[0].onended = () => {
        localStream.value = null;
        mediaConn.stopStream();
      };
    } else {
      mediaConn.stopStream();
      localStream.value = null;
    }
  };

  const startAudio = async () => {
    const stream = await mediaConn.getAudioStream();

    const audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule("/volume-processor.js");

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, "volume-processor");
    source.connect(workletNode);

    workletNode.port.onmessage = (event) => {
      const { isSpeaking: speakingNow } = event.data;

      if (speakingNow && !muted.value && !isSpeaking.value) {
        isSpeaking.value = true;
        socket.emit("activeSpeaker", { type: "add" });
      } else if (!speakingNow && isSpeaking.value) {
        isSpeaking.value = false;
        socket.emit("activeSpeaker", { type: "remove" });
      }
    };
  };

  const switchMic = () => {
    if (muted.value) {
      mediaConn.unMuteMic();
      muted.value = false;
    } else {
      mediaConn.muteMic();
      muted.value = true;
    }
  };

  const handlePeers = async (
    peersList: {
      user: User;
      voiceMuted: boolean;
      producers: {
        audio?: Producer;
        screenShare?: {
          video: {
            id: string;
          };
          audio?: {
            id: string;
          };
        };
      };
    }[]
  ) => {
    for (const peer of peersList) {
      const audioStream =
        peer.producers.audio &&
        (await mediaConn.consume(peer.producers.audio.id));

      const videoStream =
        peer.producers.screenShare &&
        (await mediaConn.consume(peer.producers.screenShare.video.id));

      const videoStreamAudio =
        peer.producers.screenShare?.audio &&
        (await mediaConn.consume(peer.producers.screenShare.audio.id));

      peers.value.set(peer.user.id, {
        stream: {
          audio: audioStream,
          screenShare: videoStream && {
            video: videoStream,
            audio: videoStreamAudio,
          },
        },
        voiceMuted: peer.voiceMuted,
        userData: peer.user,
      });
    }
  };

  const handlePeerClosedProducer = async (data: {
    peerId: string;
    type: "screenShare" | "audio";
  }) => {
    const peer = peers.value.get(data.peerId);

    switch (data.type) {
      case "screenShare":
        peer?.stream.screenShare && (peer.stream.screenShare = undefined);
        if (localPinnedStream.value) {
          localPinnedStream.value = null;
        }
        break;
      case "audio":
        peer?.stream.audio && (peer.stream.audio = undefined);
        break;
    }
  };

  const joinRoom = () => {
    socket.emit(
      "joinRoom",
      roomName,
      async ({ error }: { error: string | null }) => {
        if (error) {
          joinRoomErrorMessage.value = error;
          return;
        } else {
          await startAudio();
          await mediaConn.createDevice();
          await mediaConn.createTransport("send");
          await mediaConn.createTransport("recv");
          await mediaConn.produce("audio");

          socket.emit("getRoomPeers", handlePeers);
        }
      }
    );
  };

  const handleBeforeUnload = () => {
    socket.emit("leave", roomName);
  };

  return {
    refs: {
      localVideo,
      localStream,
      mediaConn,
      muted,
      activeSpeakers,
      isSpeaking,
      joinRoomErrorMessage,
      peers,
      localPinnedStream,
      disconnected,
    },
    registerSocketListeners,
    removeSocketListeners,
    userActions: {
      startAudio,
      switchMic,
      switchScreenShare,
      joinRoom,
      switchLocalPinStream,
    },
    clearFunctions: {
      handleBeforeUnload,
      removeSocketListeners,
    },
  };
}
