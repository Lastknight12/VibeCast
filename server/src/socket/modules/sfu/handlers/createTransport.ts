import { Type } from "@sinclair/typebox";
import { createWebRtcTransport } from "../utils";
import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/node/lib/types";
import { SctpParameters } from "mediasoup/node/lib/types";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { HandlerCallback, SocketError } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";
import ApiCoreError from "src/socket/core/errors";
import { logger } from "src/lib/logger";

interface Result {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  sctpParameters: SctpParameters | undefined;
}

const createTransportSchema = Type.Object({
  type: Type.Union([Type.Literal("send"), Type.Literal("recv")]),
});
export default function (socket: CustomSocket) {
  socket.customOn({
    event: "createTransport",
    config: {
      schema: createTransportSchema,
      expectCb: true,
      protected: true,
    },
    handler: async (input, cb: HandlerCallback<Result>) => {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomError.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      try {
        const transport = await createWebRtcTransport(room.router);
        if (input.type === "send") {
          peer.transports.send = transport;
        } else {
          peer.transports.recv = transport;
        }

        cb({
          data: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
          },
        });
      } catch (error) {
        logger.error(`Error creating transport: ${error}`);
        throw new SocketError(ApiCoreError.UNEXPECTED_ERROR);
      }
    },
  });
}
