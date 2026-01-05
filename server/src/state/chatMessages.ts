export interface Message {
  text: string;
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
}

export const chatMessagesState = new Map<string, Message[]>([]);
