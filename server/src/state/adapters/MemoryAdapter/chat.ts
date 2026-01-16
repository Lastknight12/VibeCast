import { Adapter, Message } from "../core/chat";

export class ChatAdapter implements Adapter {
    messages = new Map<string, Message[]>()
    
    createChat(roomId: string): void {
        this.messages.set(roomId, [])
    }

    getMessages(roomId: string): Message[] {
        return this.messages.get(roomId) ?? []
    }

    pushMessage(roomId: string, message: Message): void {
        const chat = this.messages.get(roomId)
        if(!chat) {
            throw new Error("Invalid room id")
        }

        chat.push(message)
    }
    
    delete(roomId: string): void {
        this.messages.delete(roomId)
    }
}