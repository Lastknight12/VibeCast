<script setup lang="ts">
import { cn } from "~/lib/utils";

interface Message {
  text: string;
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
}

const props = defineProps<{ roomId: string }>();

const socket = useSocket();
const room = useRoom(props.roomId);

const chatMessage = ref("");
const isChatShown = ref(false);
const messages = ref<Message[]>([]);
const loading = ref(true);
const subscribers = ref<Function[]>([]);

const container = ref<HTMLDivElement | null>(null);

function sendMessage() {
  useSocketEmit("sendMessage", { message: chatMessage.value });
  chatMessage.value = "";
}

const scrollToEnd = async () => {
  await nextTick();
  if (container.value) {
    container.value.scrollTo({
      top: container.value.scrollHeight + container.value.clientHeight,
    });
  }
};
onMounted(() => {
  watch(room.refs.connected, (connected, _) => {
    if (connected) {
      const { data, loading: socketLoading } =
        useSocketEmit<Message[]>("getMessages");

      watch(socketLoading, (isLoading) => {
        loading.value = isLoading;
      });

      watch(data, (newMessages) => {
        if (newMessages) {
          messages.value = newMessages;
        }
      });
    }
  });

  socket.on("newMessage", (message: Message) => {
    messages.value.push(message);
    scrollToEnd();
  });
});

onUnmounted(() => {
  messages.value = [];
  subscribers.value = [];

  socket.off("newMessage");
});
</script>

<template>
  <UiButton
    class="absolute top-1 right-1 p-2.5! z-50"
    variant="outline"
    @click="isChatShown = !isChatShown"
  >
    <Icon name="material-symbols:left-panel-open" size="22" />
  </UiButton>

  <Transition name="chat">
    <div
      :class="
        cn(
          'min-h-full flex flex-col px-3 py-2 absolute top-0 right-0 opacity-100 z-40',
        )
      "
      v-show="isChatShown"
    >
      <div
        ref="container"
        class="h-[calc(100vh-24px-36px-8px*4)] overflow-y-scroll flex flex-col gap-5 mb-3 pr-3.5"
      >
        <div
          v-for="message in messages"
          :key="message.sender.id"
          class="break-all bg-gray-600/55 p-2 rounded-2xl"
        >
          <div class="max-w-3xs">
            <div class="flex gap-2 items-center mb-1">
              <img :src="message.sender.avatar" class="w-6 h-6 rounded-full" />
              <p>{{ message.sender.name }}</p>
            </div>

            <div>
              {{ message.text }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 p-2 rounded-2xl bg-gray-600/70">
        <UiInput placeholder="Enter message" v-model="chatMessage" />

        <UiButton
          variant="secondary"
          :disabled="chatMessage.length <= 0 || loading"
          @click="sendMessage"
        >
          <Icon name="ic:baseline-send" />
        </UiButton>
      </div>
    </div>
  </Transition>
</template>
