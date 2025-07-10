import type {
  Consumer,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from "mediasoup-client/types";
import type { Socket } from "socket.io-client";
import * as mediasoup from "mediasoup-client";

export class mediasoupConn {
  private socket: Socket = useSocket();

  localStream: MediaStream | null = null;
  audioStream: MediaStream | null = null;

  roomName: string;
  muted: boolean;
  activeSpeakers?: Ref<Set<string>>;

  device?: mediasoup.Device;
  transports: {
    send?: Transport;
    recv?: Transport;
  };
  producers: Map<"video" | "audio" | "video_audio", Producer | undefined>;
  consumers: Map<string, Consumer>;

  constructor(roomName: string) {
    this.roomName = roomName;
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

    stream.getAudioTracks().forEach((track) => (track.enabled = true));

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
    const rtpCapabilities = await new Promise((resolve, reject) => {
      this.socket.emit(
        "getRTPCapabilities",
        async (capabilities: RtpCapabilities) => {
          resolve(capabilities);
        }
      );
    });

    this.device = new mediasoup.Device();

    await toRaw(this.device).load({
      routerRtpCapabilities: toRaw(rtpCapabilities)!,
    });

    console.log("Device created with RTP capabilities:", rtpCapabilities);
  }

  async createTransport(type: "send" | "recv") {
    if (!this.device) {
      console.error("Device not initialized. Call createDevice first");
      return;
    }

    await new Promise((resolve, _) => {
      if (!this.device) {
        console.log("no device created");
        return;
      }

      this.socket.emit("createTransport", { type }, (transport: any) => {
        switch (type) {
          case "send": {
            this.transports.send = this.device!.createSendTransport(transport);
            resolve(null);

            this.transports.send.on("connectionstatechange", (state) => {
              console.log(`${type}ProducerTransport state:`, state);
            });

            this.transports.send.on(
              "connect",
              ({ dtlsParameters }, callback) => {
                this.socket.emit(
                  "connectTransport",
                  { dtlsParameters, type },
                  callback
                );
              }
            );

            this.transports.send.on("produce", async (parameters, callback) => {
              this.socket.emit(
                "produce",
                { parameters },
                (data: { id: string }) => {
                  callback(data);
                }
              );
            });
            return;
          }
          case "recv":
            {
              this.transports.recv =
                this.device!.createRecvTransport(transport);
              resolve(null);

              this.transports.recv.on("connectionstatechange", (state) => {
                console.log(`${type}ConsumerTransport state:`, state);
              });

              this.transports.recv.on(
                "connect",
                ({ dtlsParameters }, callback) => {
                  this.socket.emit(
                    "connectTransport",
                    { dtlsParameters, type },
                    callback
                  );
                }
              );
            }
            return;
        }
      });
    });
  }

  async consume(producerId: string) {
    if (!this.device) {
      console.error("device not initialized");
      return;
    }

    if (!producerId) {
      console.error("No producerId provided");
      return;
    }

    if (!this.transports.recv) {
      console.log("no transport created");
    }

    let stream: MediaStream = new MediaStream();

    await new Promise((resolve, _) => {
      this.socket.emit(
        "consume",
        {
          producerId,
          rtpCapabilities: this.device!.rtpCapabilities,
        },
        async (params: {
          id: string;
          producerId: string;
          kind: MediaKind;
          rtpParameters: RtpParameters;
        }) => {
          const consumer = await this.transports.recv!.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
          });

          this.consumers.set(consumer.id, consumer);
          stream.addTrack(consumer.track);
          this.socket.emit("consumerReady", { id: consumer.id });

          resolve(null);
        }
      );
    });

    return stream;
  }

  async closeConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      console.log("no consumer with this id exist" + consumerId);
      return;
    }

    consumer.close();
    this.consumers.delete(consumerId);
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

    const encodings =
      type === "video"
        ? [
            {
              rid: "fhd", // 1080p
              maxBitrate: 6000 * 1024,
              scaleResolutionDownBy: 1,
            },
            {
              rid: "hd", // 720p
              maxBitrate: 4000 * 1024,
              scaleResolutionDownBy: 1.5,
            },
            {
              rid: "sd", // 480p
              maxBitrate: 2000 * 1024,
              scaleResolutionDownBy: 2.25,
            },
            {
              rid: "ld", // 360p
              maxBitrate: 1000 * 1024,
              scaleResolutionDownBy: 3,
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

  stopStream() {
    const videoProducer = this.producers.get("video");
    const systemAudioProducer = this.producers.get("video_audio");

    if (!videoProducer) {
      console.log("no video producer created");
      return;
    }

    videoProducer.close();
    systemAudioProducer?.close();

    this.localStream = null;

    this.socket.emit("closeProducer", { type: "video" });
  }

  muteMic() {
    const audioProducer = this.producers.get("audio");

    if (audioProducer) {
      audioProducer.pause();
      this.muted = true;
      this.socket.emit("micOff");
    } else {
      console.log("Audio producer not created");
    }
  }

  unMuteMic() {
    const audioProducer = this.producers.get("audio");

    if (audioProducer) {
      audioProducer.resume();
      this.muted = false;
      this.socket.emit("micOn");
    } else {
      console.log("Audio producer not created");
    }
  }

  close() {
    this.roomName = "";
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
}
