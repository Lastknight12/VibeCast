import type {
  Consumer,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpEncodingParameters,
  RtpParameters,
  Transport,
} from "mediasoup-client/types";
import * as mediasoup from "mediasoup-client";
import type { SocketCallbackArgs } from "./useSocket";

export class mediasoupConn {
  private socket = useSocket();

  localStream: MediaStream | null = null;
  audioStream: MediaStream | null = null;

  muted: boolean;
  activeSpeakers?: Ref<Set<string>>;

  device?: mediasoup.Device;
  transports: {
    send?: Transport;
    recv?: Transport;
  };
  producers: Map<"video" | "audio" | "video_audio", Producer | undefined>;
  consumers: Map<string, Consumer>;

  constructor() {
    this.muted = true;

    this.transports = {};
    this.consumers = new Map();
    this.producers = new Map();
  }

  async getAudioStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
      },
    });

    stream.getAudioTracks();

    this.audioStream = stream;

    return stream;
  }

  async getMediaStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: true,
    });

    this.localStream = stream;

    return stream;
  }

  async createDevice() {
    const rtpCapabilities = await new Promise((resolve, reject) => {
      this.socket.emit(
        "getRTPCapabilities",
        async ({ data, errors }: SocketCallbackArgs<RtpCapabilities>) => {
          if (errors) {
            reject(errors[0]?.message);
            return;
          }

          resolve(data);
        }
      );
    });

    this.device = new mediasoup.Device();

    await toRaw(this.device).load({
      routerRtpCapabilities: rtpCapabilities!,
    });

    console.log("Device created with RTP capabilities:", rtpCapabilities);
  }

  async createTransport(type: "send" | "recv") {
    return new Promise<void>((resolve, reject) => {
      if (!this.device) return reject("no device created");

      this.socket.emit(
        "createTransport",
        { type },
        ({ data, errors }: SocketCallbackArgs<any>) => {
          if (errors) {
            return reject(errors[0]!.message);
          }

          const transport =
            type === "send"
              ? this.device!.createSendTransport(data)
              : this.device!.createRecvTransport(data);

          transport.on("connect", ({ dtlsParameters }, callback) => {
            this.socket.emit(
              "connectTransport",
              { dtlsParameters, type },
              ({ errors }: SocketCallbackArgs<unknown>) => {
                if (errors) return console.log(errors[0]?.message);
                callback();
              }
            );
          });

          if (type === "send") {
            transport.on("produce", (parameters, callback) => {
              this.socket.emit(
                "produce",
                parameters,
                ({ data, errors }: SocketCallbackArgs<{ id: string }>) => {
                  if (errors) return console.log(errors[0]?.message);
                  callback({ id: data?.id });
                }
              );
            });
          }

          if (type === "send") this.transports.send = transport;
          else this.transports.recv = transport;
          resolve();
        }
      );
    });
  }

  async consume(producerId: string) {
    if (!this.device || !this.device.loaded) {
      console.error("device not initialized");
      return;
    }

    if (!producerId) {
      console.error("No producerId provided");
      return;
    }

    if (!this.transports.recv) {
      console.log("no transport created");
      return;
    }

    let createdConsumer: Consumer | undefined;

    await new Promise((resolve, reject) => {
      this.socket.emit(
        "consume",
        {
          producerId,
          rtpCapabilities: this.device!.rtpCapabilities,
        },
        async ({
          data,
          errors,
        }: SocketCallbackArgs<{
          id: string;
          producerId: string;
          kind: MediaKind;
          rtpParameters: RtpParameters;
        }>) => {
          if (!errors) {
            const consumer = await this.transports.recv!.consume({
              id: data.id,
              producerId: data.producerId,
              kind: data.kind,
              rtpParameters: data.rtpParameters,
            });

            this.consumers.set(consumer.id, consumer);
            createdConsumer = consumer;
            this.socket.emit(
              "consumerReady",
              { id: consumer.id },
              ({ errors }: SocketCallbackArgs<unknown>) => {
                if (errors) return reject(errors[0]!.message);
                resolve(null);
              }
            );
          } else {
            reject(errors[0]!.message);
          }
        }
      );
    });

    return createdConsumer;
  }

  async closeConsumer(id: string) {
    const consumer = this.consumers.get(id);

    if (!consumer) {
      console.log("no consumer with this id exist " + id);
      return;
    }

    consumer.close();
    this.consumers.delete(id);
    this.socket.emit(
      "closeConsumer",
      { id },
      (data: SocketCallbackArgs<unknown>) => {
        if (
          data.errors &&
          data.errors[0]?.code === "MEDIASOUP_CONSUMER_NOT_FOUND"
        ) {
          console.log("invalid consumer id");
        }
      }
    );
  }

  async produce(type: "video" | "audio" | "video_audio") {
    if (
      (type === "video" && !this.localStream) ||
      (type === "audio" && !this.audioStream)
    ) {
      console.error(type + "stream not available. Call getMediaStream first");
      return;
    }

    if (!this.transports.send) {
      console.error("Producer transport not initialized");
      return;
    }

    if (!this.device) {
      console.error("Device not initialized");
      return;
    }

    const parsedType = type === "video_audio" ? "audio" : type;
    if (!this.device.canProduce(parsedType)) {
      console.error(
        `Device cannot produce ${type} with current RTP Capabilities`
      );
      return;
    }

    let track: MediaStreamTrack | undefined;

    switch (type) {
      case "video": {
        track = this.localStream?.getVideoTracks()[0];
        break;
      }
      case "video_audio": {
        track = this.localStream?.getAudioTracks()[0];
        break;
      }
      case "audio": {
        track = this.audioStream?.getAudioTracks()[0];
        break;
      }
    }

    const encodings: RtpEncodingParameters[] | undefined =
      type === "video"
        ? [
            {
              rid: "low",
              scaleResolutionDownBy: 3,
              maxBitrate: 300_000,
              maxFramerate: 30,
              scalabilityMode: "L1T2",
            },
            {
              rid: "mid",
              scaleResolutionDownBy: 1.5,
              maxBitrate: 1_000_000,
              maxFramerate: 30,
              scalabilityMode: "L1T2",
            },
            {
              rid: "high",
              scaleResolutionDownBy: 1,
              maxBitrate: 2_500_000,
              maxFramerate: 30,
              scalabilityMode: "L1T3",
            },
          ]
        : undefined;

    const producer = await this.transports.send.produce({
      track: track,
      encodings,
      appData: {
        type,
      },
    });

    switch (type) {
      case "video": {
        this.producers.set("video", producer);
        break;
      }
      case "audio": {
        this.producers.set("audio", producer);
        producer.pause();
        break;
      }
      case "video_audio":
        this.producers.set("video_audio", producer);
        break;
    }
  }

  async stopStream() {
    const videoProducer = this.producers.get("video");
    const systemAudioProducer = this.producers.get("video_audio");

    if (!videoProducer) {
      console.log("no video producer created");
      return;
    }

    videoProducer.close();
    systemAudioProducer?.close();

    this.localStream = null;

    await new Promise<void>((resolve, reject) => {
      this.socket.emit(
        "closeProducer",
        { type: "video" },
        ({ errors }: SocketCallbackArgs<unknown>) => {
          if (errors) {
            reject(errors[0]!.message);
          }
          resolve();
        }
      );
    });
  }

  toggleMic() {
    if (this.audioStream && this.audioStream.getAudioTracks().length > 0) {
      this.muted = !this.muted;
      this.audioStream.getAudioTracks()[0]!.enabled = !this.muted;
      this.socket.emit("switchMic");
    }

    return this.muted;
  }

  close() {
    this.localStream = null;
    this.audioStream = null;
    this.muted = true;
    this.producers = new Map();
    this.consumers = new Map();

    Object.values(this.transports).forEach((t) => {
      t.close();
    });
    this.transports = {};
  }

  getProducerstatistic(type: "video" | "audio" | "video_audio") {
    const video = this.producers.get("video")?.getStats();
    const video_audio = this.producers.get("video_audio")?.getStats();
    const audio = this.producers.get("audio")?.getStats();

    const stats = { video, audio, video_audio };
    return stats[type];
  }
}
