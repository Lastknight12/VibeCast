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
  activeSpeakers: Ref<Set<string>> | null;

  device?: mediasoup.Device;
  transports: {
    send?: Transport;
    recv?: Transport;
  };
  producers: {
    video?: Producer;
    audio?: Producer;
  };
  consumers: Map<string, Consumer>;

  constructor(roomName: string, activeSpeakersRef: Ref<Set<string>>) {
    this.roomName = roomName;
    this.muted = true;
    this.activeSpeakers = activeSpeakersRef;

    this.transports = {};
    this.consumers = new Map();
    this.producers = {};
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
        frameRate: { ideal: 30 },
      },
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

    console.log(
      "Device created with RTP capabilities:",
      toRaw(rtpCapabilities)
    );
  }

  async createTransport(type: "send" | "recv") {
    if (!this.device) {
      console.error("Device not initialized. Call createDevice first");
      return;
    }

    await new Promise((resolve, _) => {
      this.socket.emit("createTransport", type, (transport: any) => {
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
                  async () => {
                    callback();
                  }
                );
              }
            );

            this.transports.send.on("produce", async (parameters, callback) => {
              this.socket.emit(
                "produce",
                {
                  ...parameters,
                  type: parameters.kind,
                },
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

          this.socket.emit("consumerReady", consumer.id);

          resolve(null);
        }
      );
    });

    return stream;
  }

  async closeConsumer(consumerId: string) {
    if (!this.consumers.get(consumerId)) {
      console.log("no consumer with this id exist" + consumerId);
      return;
    }

    this.consumers.get(consumerId)!.close();
  }

  async produce(type: "video" | "audio") {
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

    if (!this.device.canProduce(type)) {
      console.error(
        `Device cannot produce ${type} with current RTP Capabilities`
      );
      return;
    }

    const track =
      type === "video"
        ? this.localStream!.getVideoTracks()[0]
        : this.audioStream?.getAudioTracks()[0];

    const encodings =
      type === "video"
        ? [
            { rid: "h", maxBitrate: 1200 * 1024 },
            {
              rid: "m",
              maxBitrate: 600 * 1024,
              scaleResolutionDownBy: 2,
            },
            {
              rid: "l",
              maxBitrate: 300 * 1024,
              scaleResolutionDownBy: 4,
            },
          ]
        : undefined;

    const producer = await this.transports.send.produce({
      track: track,
      codecOptions: {
        videoGoogleStartBitrate: 1000,
      },
      encodings,
    });

    switch (type) {
      case "video": {
        this.producers.video = producer;
        return;
      }
      case "audio": {
        this.producers.audio = producer;
        producer.pause();
        return;
      }
    }
  }

  stopStream() {
    const videoProducer = this.producers.video;

    if (!videoProducer) {
      console.log("no video producer created");
      return;
    }

    videoProducer.close();
    this.localStream = null;

    this.socket.emit("closeVideoProducer");
  }

  muteMic() {
    if (this.producers.audio) {
      this.producers.audio.pause();
      this.muted = true;
      this.socket.emit("micOff");
    } else {
      console.log("Audio producer not created");
    }
  }

  unMuteMic() {
    if (this.producers.audio) {
      this.producers.audio.resume();
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
    this.activeSpeakers = null;
    this.muted = true;

    console.log(this.transports.recv?.getStats(), "before");
    Object.values(this.transports).forEach((t) => {
      t.close();
    });
    console.log(this.transports.recv?.getStats(), "after");

    Object.values(this.producers).forEach((p) => {
      p.close();
    });

    this.consumers.forEach((c) => {
      c.close();
    });

    this.transports = {};
    this.producers = {};
    this.consumers = new Map();
  }
}
