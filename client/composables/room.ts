import type { User } from "better-auth/types";
import type { Producer } from "mediasoup-client/types";

export function useRoom(roomName: string, mediaConn: mediasoupConn) {
  const socket = useSocket();

  const localVideo = ref<HTMLVideoElement | null>(null);
  const localStream = ref<MediaStream | null>(null);
  const isSpeaking = ref<boolean>(false);
  const activeSpeakers = ref<Set<string>>(new Set());
  const muted = ref(mediaConn.muted);

  const joinRoomErrorMessage = ref<string | null>(null);

  const disconnected = ref<boolean>(false);

  const peers = ref<
    Map<
      string,
      {
        stream?: {
          audio?: MediaStream | null;
          video?: MediaStream | null;
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
    socket.on("consumerClosed", handleClosedConsumer);

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
    socket.off("consumerClosed", handleClosedConsumer);

    socket.off("micOff", handleUserMuted);
    socket.off("micOn", handleUserUnMuted);

    socket.off("addActiveSpeaker", handleAddSpeaker);
    socket.off("removeActiveSpeaker", handleRemoveSpeaker);

    socket.off("leaveRoom", handleLeaveRoom);
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
    type: "video" | "audio"
  ) => {
    const stream = await mediaConn.consume(producerId);

    if (!stream) {
      console.log("no stream");
      return;
    }

    const peer = peers.value.get(userId);

    if (type === "video") {
      peer!.stream!.video = stream!;
    } else {
      peer!.stream!.audio = stream!;
    }
  };

  const switchScreenShare = async () => {
    if (!localStream.value) {
      await mediaConn.getMediaStream();

      await mediaConn.produce("video");

      localStream.value = mediaConn.localStream;

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

    mediaConn.produce("audio");

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
      producers: { audio?: Producer; video?: Producer };
    }[]
  ) => {
    for (const peer of peersList) {
      const audioStream =
        peer.producers.audio &&
        (await mediaConn.consume(peer.producers.audio.id));

      const videoStream =
        peer.producers.video &&
        (await mediaConn.consume(peer.producers.video.id));

      peers.value.set(peer.user.id, {
        stream: { audio: audioStream, video: videoStream },
        voiceMuted: peer.voiceMuted,
        userData: peer.user,
      });
    }
  };

  const handleClosedConsumer = (
    consumerId: string,
    socketId: string,
    type: "video" | "audio"
  ) => {
    mediaConn.closeConsumer(consumerId);
    const stream = peers.value.get(socketId)?.stream;

    if (type === "video") {
      if (stream) stream.video = null;
    } else {
      if (stream) stream.audio = null;
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
          await mediaConn.createDevice();
          await mediaConn.createTransport("send");
          await mediaConn.createTransport("recv");

          await startAudio();

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
      disconnected,
    },
    registerSocketListeners,
    removeSocketListeners,
    userActions: {
      startAudio,
      switchMic,
      switchScreenShare,
      joinRoom,
    },
    clearFunctions: {
      handleBeforeUnload,
      removeSocketListeners,
    },
  };
}
