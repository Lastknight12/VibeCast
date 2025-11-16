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
import { ApiRoomErrors } from "../../room/utils/errors";
import { ApiCoreErrors } from "src/socket/core/errors";

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
      const { data, context } = input;
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      try {
        const transport = await createWebRtcTransport(room.router);
        if (data.type === "send") {
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
        context.logger.error(`Error creating transport: ${error}`);
        throw new SocketError(ApiCoreErrors.UNEXPECTED_ERROR);
      }
    },
  });
}
