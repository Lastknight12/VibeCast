import { CustomSocket, HandlerCallback, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";
import { chatMessagesState, Message } from "src/state/chatMessages";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getMessages",
    config: {
      expectCb: true,
    },
    handler(_input, cb: HandlerCallback<Message[]>) {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const roomMessages = chatMessagesState.get(user.roomId) ?? [];

      cb({ data: roomMessages, errors: undefined });
    },
  });
}
