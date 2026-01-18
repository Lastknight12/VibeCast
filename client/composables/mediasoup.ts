import type {
  Consumer,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpEncodingParameters,
  RtpParameters,
  Transport,
  TransportOptions,
} from "mediasoup-client/types";
import * as mediasoup from "mediasoup-client";

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

  _enableSharingLayers?: Boolean;
  _numSharingSimulcastStreams: number;

  constructor(params: {
    enableSharingLayers?: boolean;
    numSharingSimulcastStreams?: number;
  }) {
    this.muted = true;

    this.transports = {};
    this.consumers = new Map();
    this.producers = new Map();

    this._enableSharingLayers = true;
    this._numSharingSimulcastStreams = params.numSharingSimulcastStreams ?? 2;
  }

  async getAudioStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
      },
    });

    this.audioStream = stream;

    return stream;
  }

  async getMediaStream() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 },
      },
      audio: true,
    });

    this.localStream = stream;

    return stream;
  }

  async createDevice() {
    const { data: rtpCapabilities, errors } =
      await emitSocket<RtpCapabilities>("getRTPCapabilities");

    if (errors) {
      return;
    }
    if (rtpCapabilities) {
      this.device = new mediasoup.Device();
      await toRaw(this.device).load({
        routerRtpCapabilities: rtpCapabilities,
      });
      console.log("Device created with RTP capabilities:", rtpCapabilities);
    }
  }

  async createTransport(type: "send" | "recv") {
    if (!this.device) throw new Error("no device created");

    const { data, errors } = await emitSocket<TransportOptions>(
      "createTransport",
      { type },
    );
    if (errors) {
      throw new Error(errors[0]?.message);
    }
    if (data) {
      const transport =
        type === "send"
          ? this.device!.createSendTransport(data)
          : this.device!.createRecvTransport(data);

      transport.on(
        "connect",
        async ({ dtlsParameters }, callback, errorCallback) => {
          const { errors } = await emitSocket("connectTransport", {
            dtlsParameters,
            type,
          });

          if (errors) {
            errorCallback(Error(errors[0]?.message));
            console.log(errors[0]?.message);
            return;
          }
          callback();
        },
      );

      if (type === "send") {
        transport.on("produce", async (parameters, callback, errorCallback) => {
          const { data, errors } = await emitSocket<{ id: string }>(
            "produce",
            parameters,
          );
          if (errors) {
            errorCallback(Error(errors[0]?.message));
            console.log(errors[0]?.message);
            return;
          }
          if (data) {
            callback({ id: data.id });
          }
        });
      }

      if (type === "send") this.transports.send = transport;
      else this.transports.recv = transport;
    }
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

    const { data, errors } = await emitSocket<{
      id: string;
      producerId: string;
      kind: MediaKind;
      rtpParameters: RtpParameters;
    }>("consume", {
      producerId,
      rtpCapabilities: this.device!.rtpCapabilities,
    });
    if (errors) {
      throw new Error(errors[0]?.message);
    }
    if (data) {
      const consumer = await this.transports.recv!.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      this.consumers.set(consumer.id, consumer);
      createdConsumer = consumer;

      const { errors } = await emitSocket("consumerReady", { id: consumer.id });
      if (errors) {
        throw new Error(errors[0]?.message);
      }
    }

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

    const { errors } = await emitSocket("closeConsumer", { id });
    if (errors) {
      console.log(errors[0]?.message);
    }
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
        `Device cannot produce ${type} with current RTP Capabilities`,
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

    let encodings: RtpEncodingParameters[] | undefined;

    if (this._enableSharingLayers) {
      const firstVideoCodec = this.device.rtpCapabilities?.codecs?.find(
        (c) => c.kind === "video",
      );

      if (
        firstVideoCodec &&
        ["video/vp9", "video/av1"].includes(
          firstVideoCodec.mimeType.toLowerCase(),
        )
      ) {
        encodings = [
          {
            maxBitrate: 5000000,
            scalabilityMode: "L3T3",
            dtx: true,
          },
        ];
      } else {
        encodings = [
          {
            scaleResolutionDownBy: 1,
            maxBitrate: 5000000,
            scalabilityMode: "L1T3",
            dtx: true,
          },
        ];

        if (this._numSharingSimulcastStreams > 1) {
          encodings.unshift({
            scaleResolutionDownBy: 2,
            maxBitrate: 1000000,
            scalabilityMode: "L1T3",
            dtx: true,
          });
        }

        if (this._numSharingSimulcastStreams > 2) {
          encodings.unshift({
            scaleResolutionDownBy: 4,
            maxBitrate: 500000,
            scalabilityMode: "L1T3",
            dtx: true,
          });
        }
      }
    }

    const producer = await this.transports.send.produce({
      track: track,
      encodings: type === "video" ? encodings : undefined,
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

    const { errors } = await emitSocket("closeProducer", { type: "video" });
    if (errors) {
      throw new Error(errors[0]?.message);
    }
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

  async getConsumerStatistic() {
    const consumersArray = Array.from(this.consumers.values());

    const statsPromises = consumersArray
      .filter((consumer) => consumer.kind === "video")
      .map(async (consumer) => {
        const stats = await consumer.getStats();
        return { id: consumer.id, stats: stats };
      });

    const results = await Promise.all(statsPromises);

    return results;
  }
}
