import type { User } from "better-auth/types";
import type { SocketCallbackArgs } from "./useSocket";

type PeerStream = {
  stream?: MediaStream;
  consumerId?: string;
  producerId?: string;
};

export interface Peer {
  streams: {
    audio: PeerStream;
    screenShare: {
      thumbnail?: string;
      active: boolean;
      video: PeerStream;
      audio: PeerStream;
    };
  };
  voiceMuted: boolean;
  userData: User;
}

export type pinnedStream =
  | {
      stream: MediaStream;
      peerId: string;
    }
  | {
      stream: null;
      peerId: null;
    };

export function useRoom(roomId: string) {
  const pinnedStream = ref<pinnedStream | null>(null);
  const peers = ref<Map<string, Peer>>(new Map());

  const socket = useSocket();
  const toast = useToast();
  const mediaConn = useMediasoup();
  const { startMic } = useMedia(mediaConn);

  const videoElem = ref<HTMLVideoElement | null>(null);
  const activeSpeakers = ref<Set<string>>(new Set());
  const joinRoomErrorMessage = ref<string | null>(null);
  const disconnected = ref<boolean>(false);

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

  async function watchStream(peerId: string) {
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
  }

  async function stopWatchingStream(streamerPeerId: string) {
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
    if (pinnedStream.value?.peerId === streamerPeerId) {
      pinnedStream.value = null;
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
  }

  function togglePinnedStream(peerId: string) {
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

    if (!pinnedStream.value) {
      pinnedStream.value = { stream, peerId };
    } else {
      pinnedStream.value = null;
    }
  }

  async function joinRoom() {
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
            await mediaConn.createDevice();
            await mediaConn.createTransport("send");
            await mediaConn.createTransport("recv");
            await startMic();
            socket.emit("getRoomPeers", handlePeers);

            resolve(null);
          }
        }
      );
    });
  }

  function handleLeaveRoom() {
    mediaConn.close();
    disconnected.value = true;
  }

  function handleUserJoin(data: { user: User }) {
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
  }

  function handleUserMuted(id: string) {
    const peer = peers.value.get(id);
    if (peer) {
      peer.voiceMuted = true;
    }
  }

  function handleUserUnMuted(id: string) {
    const peer = peers.value.get(id);
    if (peer) {
      peer.voiceMuted = false;
    }
  }

  function handleUserDisconnect(userId: string) {
    peers.value.delete(userId);
  }

  async function handleNewProducer(
    producerId: string,
    userId: string,
    type: "video" | "audio" | "video_audio"
  ) {
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
  }

  function handleConsumerClosed(consumerId: string) {
    mediaConn.closeConsumer(consumerId);
  }

  async function handlePeers({
    data: peersList,
    errors,
  }: SocketCallbackArgs<
    {
      userData: User;
      voiceMuted: boolean;
      producers: {
        audio?: string;
        screenShare?: {
          thumbnail?: string;
          video: string;
          audio?: string;
        };
      };
    }[]
  >) {
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
              thumbnail: peer.producers.screenShare?.thumbnail,
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
  }

  async function handlePeerClosedProducer(data: {
    peerId: string;
    type: "screenShare" | "audio";
  }) {
    const peer = peers.value.get(data.peerId);

    switch (data.type) {
      case "screenShare":
        peer?.streams.screenShare &&
          (peer.streams.screenShare = {
            active: false,
            video: {},
            audio: {},
          });
        if (pinnedStream.value?.peerId === data.peerId) {
          pinnedStream.value = null;
        }
        break;
      case "audio":
        peer?.streams.audio && (peer.streams.audio = {});
        break;
    }
  }

  function handleBeforeUnload() {
    if (!disconnected.value && !joinRoomErrorMessage.value) {
      socket.emit("leave", ({ errors }: SocketCallbackArgs<unknown>) => {
        if (errors) {
          toast.error({ message: errors[0]!.message });
        }
      });
    }
  }

  return {
    refs: {
      mediaConn,
      activeSpeakers,
      joinRoomErrorMessage,
      peers,
      pinnedStream,
      disconnected,
      videoElem,
    },
    registerSocketListeners,
    removeSocketListeners,
    userActions: {
      togglePinnedStream,
      watchStream,
      stopWatchingStream,
      joinRoom,
    },
    clearFunctions: {
      handleBeforeUnload,
      removeSocketListeners,
    },
  };
}
