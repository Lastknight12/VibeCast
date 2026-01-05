import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";
import { CustomSocket, HandlerCallback, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";
import { getRoomRouter } from "../utils";
import { ApiSfuErrors } from "../errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getRTPCapabilities",
    config: {
      protected: true,
      expectCb: true,
    },
    handler: (_input, cb: HandlerCallback<RtpCapabilities>) => {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const router = getRoomRouter(user.roomId);
      if (!router) {
        throw new SocketError(ApiSfuErrors.router.NOT_FOUND);
      }

      cb({ data: router.rtpCapabilities });
    },
  });
}
