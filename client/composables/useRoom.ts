import type { User } from "better-auth/types";
import type { SocketCallback, SocketCallbackArgs } from "./useSocket";

interface PeerStream {
  stream?: MediaStream;
  consumerId?: string;
  producerId?: string;
}

interface Peer {
  streams: {
    audio: PeerStream;
    screenShare: {
      active: boolean;
      video: PeerStream;
      audio: PeerStream;
    };
  };
  voiceMuted: boolean;
  userData: User;
}

export function useRoom(roomId: string, mediaConn: mediasoupConn) {
  const socket = useSocket();
  const toast = useToast();

  const localStream = ref<MediaStream | null>(null);
  const localPinnedStreams = ref<{
    stream: MediaStream;
    peerId: string;
  } | null>(null);
  const isSpeaking = ref<boolean>(false);
  const activeSpeakers = ref<Set<string>>(new Set());
  const muted = ref(mediaConn.muted);

  const joinRoomErrorMessage = ref<string | null>(null);

  const disconnected = ref<boolean>(false);

  const peers = ref<Map<string, Peer>>(new Map());

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

  const pinStream = (peerId: string) => {
    const peer = peers.value.get(peerId);
    if (!peer) {
      console.log("no peer founded");
      return;
    }

    const stream = peer.streams.screenShare?.video?.stream;
    if (!stream) {
      console.log("no stream founded");
      return;
    }

    if (!localPinnedStreams.value) {
      localPinnedStreams.value = { stream, peerId };
    } else {
      localPinnedStreams.value = null;
    }
  };

  const handleLeaveRoom = () => {
    mediaConn.close();
    disconnected.value = true;
  };

  const handleUserJoin = (data: { user: User }) => {
    peers.value.set(data.user.id, {
      streams: {
        audio: {},
        screenShare: {
          active: false,
          video: {},
          audio: {},
        },
      },
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
    const peer = peers.value.get(userId);
    if (!peer) {
      toast.error({ message: "peer not founded" });
      return;
    }

    switch (type) {
      case "video": {
        peer.streams.screenShare.video = {
          producerId,
        };
        break;
      }
      case "audio": {
        const consumer = await mediaConn.consume(producerId);

        if (!consumer) {
          console.log("no consumer created");
          return;
        }
        const stream = new MediaStream([consumer.track]);

        peer.streams.audio = {
          stream,
          producerId,
        };
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
        peer.streams.screenShare.audio = { producerId };
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

  const watchStream = async (peerId: string) => {
    const peer = peers.value.get(peerId);
    if (!peer) {
      console.log("No peers founded");
      return;
    }

    const videoProducerId = peer.streams.screenShare.video.producerId;
    const audioProducerId = peer.streams.screenShare.audio.producerId;
    if (!videoProducerId) {
      console.log("no producerId founded");
      return;
    }

    const videoConsumer = await mediaConn.consume(videoProducerId);
    if (!videoConsumer) {
      console.log("Enexcepted error while creating consumer");
      return;
    }
    const audioConsumer = audioProducerId
      ? await mediaConn.consume(audioProducerId)
      : undefined;

    const videoStream = new MediaStream([videoConsumer.track]);
    const audioStream = audioConsumer && new MediaStream([audioConsumer.track]);

    peer.streams.screenShare = {
      active: true,
      video: {
        stream: videoStream,
        producerId: videoConsumer.producerId,
        consumerId: videoConsumer.id,
      },
      audio: {
        stream: audioStream,
        consumerId: audioConsumer?.id,
        producerId: audioConsumer?.producerId,
      },
    };
  };

  const stopWatchingStream = async (streamerPeerId: string) => {
    const peer = peers.value.get(streamerPeerId);
    if (!peer) {
      console.log("No peer founded");
      return;
    }
    if (!peer.streams.screenShare.video.consumerId) {
      console.log("no consumerId founded");
      return;
    }

    const videoConsumer = mediaConn.consumers.get(
      peer.streams.screenShare.video.consumerId
    );
    if (!videoConsumer) {
      console.log("consumer with provided id don't exist");
      return;
    }

    const audioConsumer =
      peer.streams.screenShare.audio.stream &&
      mediaConn.consumers.get(peer.streams.screenShare.audio.consumerId!);

    await mediaConn.closeConsumer(videoConsumer.id);
    audioConsumer && (await mediaConn.closeConsumer(audioConsumer.id));
    if (localPinnedStreams.value?.peerId === streamerPeerId) {
      localPinnedStreams.value = null;
    }

    peer.streams.screenShare = {
      active: false,
      video: {
        stream: undefined,
        producerId: videoConsumer.producerId,
      },
      audio: {
        stream: undefined,
        producerId: audioConsumer?.producerId,
      },
    };
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
        const audioConsumer = peer.producers.audio
          ? await mediaConn.consume(peer.producers.audio)
          : undefined;
        const audioStream =
          audioConsumer && new MediaStream([audioConsumer.track]);

        peers.value.set(peer.userData.id, {
          streams: {
            audio: {
              stream: audioStream,
              producerId: audioConsumer?.producerId,
            },
            screenShare: {
              active: false,
              video: {
                producerId: peer.producers.screenShare?.video,
              },
              audio: {
                producerId: peer.producers.screenShare?.audio,
              },
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
        peer?.streams.screenShare &&
          (peer.streams.screenShare = {
            active: false,
            video: {},
            audio: {},
          });
        if (localPinnedStreams.value?.peerId === data.peerId) {
          localPinnedStreams.value = null;
        }
        break;
      case "audio":
        peer?.streams.audio && (peer.streams.audio = {});
        break;
    }
  };

  const joinRoom = async () => {
    await new Promise((resolve, reject) => {
      socket.emit(
        "joinRoom",
        {
          roomId,
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
      localStream,
      mediaConn,
      muted,
      activeSpeakers,
      isSpeaking,
      joinRoomErrorMessage,
      peers,
      localPinnedStreams,
      disconnected,
    },
    registerSocketListeners,
    removeSocketListeners,
    userActions: {
      startAudio,
      switchMic,
      switchScreenShare,
      joinRoom,
      pinStream,
      watchStream,
      stopWatchingStream,
    },
    clearFunctions: {
      handleBeforeUnload,
      removeSocketListeners,
    },
  };
}
