<script setup lang="ts">
import type { Socket } from "socket.io-client";
import {
  collectConsumersMetrics,
  collectProducersMetrics,
} from "~/lib/metrics";
import { user } from "~/lib/randomUser";

const socket = useSocket();
const route = useRoute();
const roomId = route.params.roomId as string;
const roomName = route.query.name;

useHead({
  title: `${route.params.roomId}`,
  meta: [
    {
      name: "description",
      content:
        "VibeCast is a video conferencing app where you can create a room and invite your friends to speak together!",
    },
  ],
});

const { data: authData } = { data: { user } };

const loading = ref(true);
const isDisconnected = computed(() => room.refs.disconnected.value);
const error = ref<string | null>(null);

const mediaConn = useMediasoup();
const toast = useToast();
const room = useRoom(roomId);

watchEffect(() => {
  useHead({
    title: `"${roomName}" | ${room.refs.peers.value.size + 1} peers`,
  });
});

function handleBeforeUnload(socket: Socket) {
  if (!isDisconnected.value && !error.value) {
    socket.emit("leave", ({ errors }: SocketCallbackArgs<unknown>) => {
      if (errors) {
        toast.error({ message: errors[0]!.message });
      }
    });
  }
}

let interval: NodeJS.Timeout;

onMounted(async () => {
  try {
    room.registerSocketListeners();
    await room.userActions.joinRoom();
  } catch (errMsg) {
    socket.disconnect();
    error.value = errMsg as string;
  } finally {
    loading.value = false;
  }

  interval = setInterval(async () => {
    collectConsumersMetrics(mediaConn, roomName as string);
    collectProducersMetrics(mediaConn, roomName as string);
  }, 2000);
});

onUnmounted(() => {
  mediaConn.close();
  room.cleanup();
  handleBeforeUnload(socket);
  clearInterval(interval);
});

async function leave() {
  await navigateTo("/");
}
</script>

<template>
  <RoomError v-if="isDisconnected" message="Discconnected from room" />
  <RoomError v-else-if="error" :message="error" />

  <div v-else>
    <div class="w-full flex justify-center">
      <video
        v-if="room.refs.pinnedStream?.value?.stream"
        :srcObject="room.refs.pinnedStream.value.stream"
        autoplay
        playsinline
        class="rounded-lg object-cover shadow max-w-[780px] mt-4"
        @click="
          room.userActions.togglePinnedStream(
            room.refs.pinnedStream.value.peerId
          )
        "
      ></video>
    </div>

    <div>
      <RoomPeersGrid
        :peers="room.refs.peers.value"
        :active-speakers="room.refs.activeSpeakers.value"
        :pinned-stream="room.refs.pinnedStream.value"
        @watch-stream="room.userActions.watchStream"
        @pin-stream="room.userActions.togglePinnedStream"
      >
        <template #localPeer>
          <RoomLocalPeer
            :userName="authData!.user.name"
            :userImage="authData!.user.image!"
          />
        </template>
      </RoomPeersGrid>

      <RoomControls @leave="leave" />
    </div>
  </div>
</template>

<style>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
