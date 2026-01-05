import { Type } from "@sinclair/typebox";
import { defaultUserAvatar } from "src/lib/auth";
import { CustomSocket, SocketError } from "src/socket/core";
import { chatMessagesState, Message } from "src/state/chatMessages";
import { ApiRoomErrors } from "../../room/errors";
import { ApiChatErrors } from "../errors";

const sendMessageSchema = Type.Object({
  message: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "sendMessage",
    config: {
      schema: sendMessageSchema,
    },
    handler(input) {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const { data } = input;

      const message: Message = {
        text: data.message,
        sender: {
          id: user.id,
          name: user.name,
          avatar: user.image ?? defaultUserAvatar,
        },
      };

      const roomMessages = chatMessagesState.get(user.roomId);
      if (!roomMessages) {
        throw new SocketError(ApiChatErrors.messages.NOT_FOUND);
      }
      roomMessages.push(message);

      socket.broadcast.emit("newMessage", message);
      socket.emit("newMessage", message);
    },
  });
}
