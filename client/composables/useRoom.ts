import type { User } from "better-auth/types";
import type { SocketCallback, SocketCallbackArgs } from "./useSocket";

export function useRoom(roomName: string, mediaConn: mediasoupConn) {
  const socket = useSocket();
  const toast = useToast();

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

  function trackVoiceActivity(
    stream: MediaStream,
    callback?: (isSpeaking: boolean) => void
  ) {
    const { speaking } = useStreamVolume(stream);
    watch(speaking, (isSpeaking) => {
      callback?.(isSpeaking);
    });
  }

  const registerSocketListeners = () => {
    socket.on("userJoined", handleUserJoin);
    socket.on("userDisconnect", handleUserDisconnect);

    socket.on("newProducer", handleNewProducer);
    socket.on("consumerClosed", handleConsumerClosed);
    socket.on("peerClosedProducer", handlePeerClosedProducer);

    socket.on("micOff", handleUserMuted);
    socket.on("micOn", handleUserUnMuted);

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
    type: "video" | "audio" | "video_audio"
  ) => {
    const stream = await mediaConn.consume(producerId);

    if (!stream) {
      toast.error({ message: "no stream recieved from consumer" });
      return;
    }

    const peer = peers.value.get(userId);
    if (!peer) {
      toast.error({ message: "peer not founded" });
      return;
    }

    switch (type) {
      case "video": {
        peer.stream.screenShare = { video: stream };
        break;
      }
      case "audio": {
        peer.stream.audio = stream;
        trackVoiceActivity(stream, (isSpeaking) => {
          if (isSpeaking) {
            activeSpeakers.value.add(peer.userData.id);
          } else {
            activeSpeakers.value.delete(peer.userData.id);
          }
        });
        break;
      }
      case "video_audio": {
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
        await mediaConn.produce("video_audio");
      }

      localStream.value!.getVideoTracks()[0]!.onended = () => {
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

    trackVoiceActivity(stream, (currSpeaking) => {
      isSpeaking.value = currSpeaking && !muted.value;
    });
  };

  const switchMic = () => {
    muted.value = mediaConn.switchMic();
  };

  const handlePeers: SocketCallback<
    {
      userData: User;
      voiceMuted: boolean;
      producers: {
        audio?: string;
        screenShare?: {
          video: string;
          audio?: string;
        };
      };
    }[]
  > = async ({ data: peersList, errors }) => {
    if (errors) {
      toast.error({ message: errors[0]!.message });
      return;
    }

    if (peersList) {
      for (const peer of peersList) {
        const audioStream = peer.producers.audio
          ? await mediaConn.consume(peer.producers.audio)
          : undefined;

        const videoStream = peer.producers.screenShare
          ? await mediaConn.consume(peer.producers.screenShare.video)
          : undefined;

        const videoStreamAudio = peer.producers.screenShare?.audio
          ? await mediaConn.consume(peer.producers.screenShare.audio)
          : undefined;

        peers.value.set(peer.userData.id, {
          stream: {
            audio: audioStream,
            screenShare: videoStream && {
              video: videoStream,
              audio: videoStreamAudio,
            },
          },
          voiceMuted: peer.voiceMuted,
          userData: peer.userData,
        });

        if (audioStream) {
          trackVoiceActivity(audioStream, (isSpeaking) => {
            if (isSpeaking) {
              activeSpeakers.value.add(peer.userData.id);
            } else {
              activeSpeakers.value.delete(peer.userData.id);
            }
          });
        }
      }
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

  const joinRoom = async () => {
    await new Promise((resolve, reject) => {
      socket.emit(
        "joinRoom",
        {
          roomName,
        },
        async ({ errors }: SocketCallbackArgs<unknown>) => {
          if (errors) {
            const errorMessage = errors[0]!.message;
            joinRoomErrorMessage.value = errorMessage;
            reject(errorMessage);
          } else {
            await startAudio();
            await mediaConn.createDevice();
            await mediaConn.createTransport("send");
            await mediaConn.createTransport("recv");
            await mediaConn.produce("audio");
            socket.emit("getRoomPeers", handlePeers);

            resolve(null);
          }
        }
      );
    });
  };

  const handleBeforeUnload = () => {
    if (!disconnected.value && !joinRoomErrorMessage.value) {
      socket.emit("leave", ({ errors }: SocketCallbackArgs<unknown>) => {
        if (errors) {
          toast.error({ message: errors[0]!.message });
        }
      });
    }
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
