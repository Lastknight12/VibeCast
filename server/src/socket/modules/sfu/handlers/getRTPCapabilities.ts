import { CustomSocket } from "src/socket/core";
import { getRoomRouter } from "../utils";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";
import { HandlerCallback, SocketError } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";

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
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const router = getRoomRouter(user.roomId);
      if (!router) {
        throw new SocketError(ApiRoomError.ROUTER_NOT_FOUND);
      }

      cb({ data: router.rtpCapabilities });
    },
  });
}
