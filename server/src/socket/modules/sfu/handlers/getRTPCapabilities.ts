import { ErrorCb, HandlerInput } from "src/socket/core";
import sfuModule from "..";
import { getRoomRouter } from "../sfu.utils";
import { RtpCapabilities } from "mediasoup/node/lib/rtpParametersTypes";

type Data = HandlerInput<{
  cb: (data: RtpCapabilities | Parameters<ErrorCb>[0]) => void;
}>;

sfuModule.defineSocketHandler({
  event: "getRTPCapabilities",
  config: {
    expectCb: true,
    protected: true,
  },
  handler(ctx, params: Data) {
    const { socket } = ctx;
    const { cb } = params;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const router = getRoomRouter(user.roomName);
    if (!router) {
      return cb({ error: "Room not found" });
    }

    cb(router.rtpCapabilities);
  },
});
