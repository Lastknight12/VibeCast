import { ChatAdapter } from "./adapters/MemoryAdapter/chat";
import { Adapter } from "./adapters/core/chat";

export const chatMessagesState: Adapter = new ChatAdapter();
