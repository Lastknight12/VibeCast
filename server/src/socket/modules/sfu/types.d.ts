import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/rtpParametersTypes";
import { DtlsParameters } from "mediasoup/node/lib/WebRtcTransportTypes";

type TransportType = "send" | "recv";
type ProducerType = "video" | "audio";

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
    },
    cb: (result: any) => void
  ) => void;
  closeVideoProducer: () => void;
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
  consumerClosed: (
    consumerId: string,
    userId: string,
    consumerKind: MediaKind
  ) => void;
  addActiveSpeaker: (userId: string) => void;
  removeActiveSpeaker: (userId: string) => void;
  micOff: (userId: string) => void;
  micOn: (userId: string) => void;
  roomDeleted: (roomName: string) => void;
  userDisconnect: (userId: string) => void;
  userLeftRoom: (roomName: string, userId: string) => void;
}
