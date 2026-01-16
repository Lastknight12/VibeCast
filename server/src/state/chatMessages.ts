import { ChatAdapter } from "./adapters/core/chat";
import { ChatMemoryAdapter } from "./adapters/MemoryAdapter/chat";

export const chatMessagesState: ChatAdapter = new ChatMemoryAdapter();
