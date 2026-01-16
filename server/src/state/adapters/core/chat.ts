export interface Message {
  text: string;
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface Adapter {
  createChat(roomId: string): void
  getMessages(roomId: string): Message[]
  pushMessage(roomId: string, message: Message): void
  delete(roomId: string): void
}