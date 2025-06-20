import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
} from "mediasoup/node/lib/types";

type TransportType = "send" | "recv";
type ProducerType = "video" | "audio" | "system_audio";

export interface ClientToServerEvents {
  getRTPCapabilities: (cb: (caps: any) => void) => void;
  createTransport: (type: TransportType, cb: (result: any) => void) => void;
  connectTransport: (
    data: {
      dtlsParameters: DtlsParameters;
      type: TransportType;
    },
    cb: (result: any) => void
  ) => void;
  produce: (
    data: {
      kind: MediaKind;
      rtpParameters: RtpParameters;
      type: ProducerType;
      appData: {
        type: ProducerType;
      };
    },
    cb: (result: any) => void
  ) => void;
  closeScreenShareProducer: () => void;
  consume: (
    data: { producerId: string; rtpCapabilities: RtpCapabilities },
    cb: (result: any) => void
  ) => void;
  consumerReady: (consumerId: string) => void;
  activeSpeaker: (data: { type: "add" | "remove" }) => void;
  micOff: (roomName: string) => void;
  micOn: (roomName: string) => void;
  leave: (roomName: string) => void;
}

export interface ServerToClientEvents {
  newProducer: (producerId: string, userId: string, type: ProducerType) => void;
  consumerClosed: (consumerId: string) => void;
  peerClosedProducer: (data: {
    peerId: string;
    type: "screenShare" | "audio";
  }) => {};
  addActiveSpeaker: (userId: string) => void;
  removeActiveSpeaker: (userId: string) => void;
  micOff: (userId: string) => void;
  micOn: (userId: string) => void;
  roomDeleted: (roomName: string) => void;
  userDisconnect: (userId: string) => void;
  userLeftRoom: (roomName: string, userId: string) => void;
}
