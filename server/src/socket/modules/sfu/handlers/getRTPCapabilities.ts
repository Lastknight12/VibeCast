import { CustomSocket } from "src/types/socket";
import { getRoomRouter } from "../sfu.utils";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";
import { HandlerCallback, SocketError } from "src/socket/core";
import { errors } from "../../errors";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getRTPCapabilities",
    config: {
      protected: true,
      expectCb: true,
    },
    handler: (_input, cb: HandlerCallback<RtpCapabilities>) => {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const router = getRoomRouter(user.roomName);
      if (!router) {
        throw new SocketError(errors.room.ROUTER_NOT_FOUND);
      }

      cb({ data: router.rtpCapabilities });
    },
  });
}
