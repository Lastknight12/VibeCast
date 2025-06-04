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
      audio: true,
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

    await new Promise((resolve, reject) => {
      this.socket.emit("createTransport", type, (transport: any) => {
        switch (type) {
          case "send": {
            this.transports.send = this.device!.createSendTransport(transport);

            resolve(null);

            this.transports.send.on("connectionstatechange", (state) => {
              console.log("producerTransport state:", state);
            });

            this.transports.send.on(
              "connect",
              ({ dtlsParameters }, callback) => {
                this.socket.emit(
                  "connectTransport",
                  { dtlsParameters, type },
                  () => {
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
                ({ id }: any) => {
                  callback({ id });
                }
              );
            });
          }
          case "recv": {
            this.transports.recv = this.device!.createRecvTransport(transport);

            resolve(null);

            this.transports.recv.on("connectionstatechange", (state) => {
              console.log("consumerTransport state:", state);
            });

            this.transports.recv.on(
              "connect",
              ({ dtlsParameters }, callback) => {
                this.socket.emit(
                  "connectTransport",
                  { dtlsParameters, roomName: this.roomName, type },
                  () => {
                    callback();
                  }
                );
              }
            );
          }
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
      console.error(type + "stream not available. Call getMedia first");
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

    const producer = await this.transports.send.produce({
      track: track,
      codecOptions: {
        videoGoogleStartBitrate: 1000,
      },
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
      console.log("no producer created");
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
      this.socket.emit("micOff", this.roomName);
    } else {
      console.log("Audio producer not created");
    }
  }

  unMuteMic() {
    if (this.producers.audio) {
      this.producers.audio.resume();
      this.muted = false;
      this.socket.emit("micOn", this.roomName);
    } else {
      console.log("Audio producer not created");
    }
  }

  closeAll() {
    this.transports.recv?.close();
    this.transports.send?.close();

    this.producers.audio?.close();
    this.producers.video?.close();

    this.consumers.forEach((c) => {
      c.close();
    });
  }
}
