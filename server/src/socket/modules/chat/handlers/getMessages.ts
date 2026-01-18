import { CustomSocket, HandlerCallback, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";
import { Message } from "src/state/adapters/core/chat";
import { chatMessagesState } from "src/state/chatMessages";

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "getMessages",
    config: {
      protected: true,
    },
    handler(input, cb: HandlerCallback<Message[]>) {
      const { user } = input.context;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const roomMessages = chatMessagesState.getMessages(user.roomId);

      cb({ data: roomMessages });
    },
  });
}
