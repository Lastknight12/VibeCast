import type { User } from "better-auth/types";
import type { SocketCallbackArgs } from "./useSocket";
import type { Consumer } from "mediasoup-client/types";

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

const pinnedStream = ref<pinnedStream | null>(null);
const peers = ref<Map<string, Peer>>(new Map());
const videoElem = ref<HTMLVideoElement | null>(null);
const activeSpeakers = ref<Set<string>>(new Set());
const disconnected = ref<boolean>(false);

export function useRoom(roomId: string) {
  const socket = useSocket();
  const toast = useToast();
  const mediaConn = useMediasoup();
  const { startMic, toggleMicState } = useMedia(mediaConn);

  const registerSocketListeners = () => {
    socket.on("userJoined", handleUserJoin);
    socket.on("userDisconnected", handleUserDisconnected);

    socket.on("newProducer", handleNewProducer);
    socket.on("consumerClosed", handleConsumerClosed);
    socket.on("userClosedProducer", handleUserClosedProducer);

    socket.on("micOff", handleUserMuted);
    socket.on("micOn", handleUserUnMuted);

    socket.on("leaveRoom", handleLeaveRoom);
  };

  const removeSocketListeners = () => {
    socket.off("userJoined", handleUserJoin);
    socket.off("userDisconnected", handleUserDisconnected);

    socket.off("newProducer", handleNewProducer);
    socket.off("consumerClosed", handleConsumerClosed);
    socket.off("userClosedProducer", handleUserClosedProducer);

    socket.off("micOff", handleUserMuted);
    socket.off("micOn", handleUserUnMuted);

    socket.off("leaveRoom", handleLeaveRoom);
  };

  async function watchStream(peerId: string, cb?: () => void) {
    const peer = peers.value.get(peerId);
    if (!peer) {
      console.log(`No peer with id: ${peerId} exist`);
      return;
    }

    const videoProducerId = peer.streams.screenShare.video.producerId;
    const audioProducerId = peer.streams.screenShare.audio.producerId;
    if (!videoProducerId) {
      console.log("video producer not created");
      return;
    }

    peer.streams.screenShare.active = true;

    try {
      const videoConsumer = await mediaConn.consume(videoProducerId);
      if (!videoConsumer) {
        throw new Error("no consumer created");
      }
      const audioConsumer = audioProducerId
        ? await mediaConn.consume(audioProducerId)
        : undefined;

      const videoStream = new MediaStream([videoConsumer.track]);
      const audioStream =
        audioConsumer && new MediaStream([audioConsumer.track]);

      peer.streams.screenShare.video = {
        stream: videoStream,
        producerId: videoConsumer.producerId,
        consumerId: videoConsumer.id,
      };
      peer.streams.screenShare.audio = {
        stream: audioStream,
        consumerId: audioConsumer?.id,
        producerId: audioConsumer?.producerId,
      };

      cb?.();
    } catch (error) {
      peer.streams.screenShare.active = false;
      toast.error({ message: "Failed to consume user stream" });
      console.log(error);
    }
  }

  async function stopWatchingStream(streamerPeerId: string) {
    if (pinnedStream.value?.peerId === streamerPeerId) {
      pinnedStream.value = null;
    }

    const peer = peers.value.get(streamerPeerId);
    if (!peer) {
      console.log(`No peer with id: ${streamerPeerId} exist`);
      return;
    }
    if (!peer.streams.screenShare.video.consumerId) {
      console.log("no video consumer founded");
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
      thumbnail: undefined,
    };
  }

  function togglePinnedStream(peerId: string) {
    const peer = peers.value.get(peerId);
    if (!peer) {
      console.log(`No peer with id: ${peerId} exist`);
      return;
    }

    const stream = peer.streams.screenShare?.video?.stream;
    if (!stream) {
      console.log("no video stream founded");
      return;
    }

    if (!pinnedStream.value) {
      pinnedStream.value = { stream, peerId };
    } else {
      pinnedStream.value = null;
    }
  }

  async function joinRoom(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      socket.emit(
        "joinRoom",
        { roomId },
        async ({ errors }: SocketCallbackArgs<unknown>) => {
          if (errors?.length) return reject(errors[0]?.message);

          try {
            await mediaConn.createDevice();
            await Promise.all([
              mediaConn.createTransport("send"),
              mediaConn.createTransport("recv"),
            ]);

            await startMic();
            await toggleMicState();

            socket.emit("getRoomPeers", handlePeers);
            resolve();
          } catch (err) {
            reject(err);
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

  function handleUserMuted(data: { userId: string }) {
    const peer = peers.value.get(data.userId);
    if (peer) {
      peer.voiceMuted = true;
    }
  }

  function handleUserUnMuted(data: { userId: string }) {
    const peer = peers.value.get(data.userId);
    if (peer) {
      peer.voiceMuted = false;
    }
  }

  function handleUserDisconnected(data: { userId: string }) {
    if (pinnedStream.value?.peerId === data.userId) {
      pinnedStream.value = null;
    }
    peers.value.delete(data.userId);
  }

  async function handleNewProducer(data: {
    producerId: string;
    userId: string;
    type: "video" | "audio" | "video_audio";
  }) {
    const peer = peers.value.get(data.userId);
    if (!peer) {
      console.log(`No peer with id: ${data.userId} exist`);
      return;
    }

    switch (data.type) {
      case "video": {
        peer.streams.screenShare.video = {
          producerId: data.producerId,
        };
        break;
      }
      case "audio": {
        try {
          const consumer = await mediaConn.consume(data.producerId);
          if (!consumer) {
            throw new Error("no consumer created");
          }

          const stream = new MediaStream([consumer.track]);

          peer.streams.audio = {
            stream,
            producerId: data.producerId,
          };
          trackVoiceActivity(stream, (isSpeaking) => {
            if (isSpeaking) {
              activeSpeakers.value.add(peer.userData.id);
            } else {
              activeSpeakers.value.delete(peer.userData.id);
            }
          });
        } catch (error) {
          toast.error({ message: "Failed to consume user audio" });
          console.log(error);
        }
        break;
      }
      case "video_audio": {
        // SOOOOO there is an issue.
        // User can see stream only after he recieves new video producer and
        // at that moment watchStream btn is available even if we don't have video audio.
        // So user have video but don't hear any audio cuz he recieves video audio producer just after click watchStream btn.
        // in that case load audio if we don't have one just in time
        if (
          peer.streams.screenShare.active &&
          !peer.streams.screenShare.audio.consumerId
        ) {
          try {
            const consumer = await mediaConn.consume(data.producerId);
            if (!consumer) throw new Error("no consumer created");

            const stream = new MediaStream([consumer?.track]);
            peer.streams.screenShare.audio.consumerId = consumer.id;
            peer.streams.screenShare.audio.stream = stream;
          } catch (error) {
            toast.error({ message: "Failed to consume stream audio" });
            console.log(error);
          }
        }
        peer.streams.screenShare.audio.producerId = data.producerId;
        break;
      }
    }
  }

  function handleConsumerClosed(data: { consumerId: string }) {
    mediaConn.closeConsumer(data.consumerId);
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
        let audioConsumer: Consumer | undefined;

        audioConsumer = peer.producers.audio
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
              thumbnail: peer.producers.screenShare?.thumbnail,
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

  async function handleUserClosedProducer(data: {
    userId: string;
    type: "screenShare" | "audio";
  }) {
    const peer = peers.value.get(data.userId);

    switch (data.type) {
      case "screenShare":
        peer?.streams.screenShare &&
          (peer.streams.screenShare = {
            active: false,
            video: {},
            audio: {},
            thumbnail: undefined,
          });

        if (pinnedStream.value?.peerId === data.userId) {
          pinnedStream.value = null;
        }
        break;
      case "audio":
        peer?.streams.audio && (peer.streams.audio = {});
        break;
    }
  }

  async function cleanup() {
    removeSocketListeners();
    pinnedStream.value = null;
    peers.value = new Map();
    videoElem.value = null;
    activeSpeakers.value = new Set();
    disconnected.value = false;
  }

  return {
    refs: {
      mediaConn,
      activeSpeakers,
      peers,
      pinnedStream,
      disconnected,
      videoElem,
    },
    registerSocketListeners,
    cleanup,
    userActions: {
      togglePinnedStream,
      watchStream,
      stopWatchingStream,
      joinRoom,
    },
  };
}
