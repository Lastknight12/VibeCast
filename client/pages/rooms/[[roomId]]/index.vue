<script setup lang="ts">
import type { Socket } from "socket.io-client";
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

// const authClient = useAuthClient();
const { data: authData } = { data: { user } };

const loading = ref(true);
const loadingStep = ref();
const showContent = ref(false);
const error = ref<string | null>(null);

const mediaConn = useMediasoup();
const toast = useToast();
const room = useRoom(roomId);

watchEffect(() => {
  useHead({
    title: `"${roomName}" | ${room.refs.peers.value.size + 1} peers`,
  });
});

const stats = ref<Awaited<ReturnType<typeof mediaConn.getProducerstatistic>>>();

function handleBeforeUnload(socket: Socket) {
  if (!room.refs.disconnected.value && !error.value) {
    socket.emit("leave", ({ errors }: SocketCallbackArgs<unknown>) => {
      if (errors) {
        toast.error({ message: errors[0]!.message });
      }
    });
  }
}

onMounted(async () => {
  try {
    room.registerSocketListeners();
    await room.userActions.joinRoom();
    await new Promise<void>((resolve, reject) => {
      loadingStep.value = "Connecting to the media server...";
      mediaConn.transports.send?.on("connectionstatechange", (state) => {
        if (state === "connected") resolve();
        if (state === "disconnected" || state === "failed")
          reject("failed to connect to the media server");
      });
    });
  } catch (errMsg) {
    socket.disconnect();
    error.value = errMsg as string;
  } finally {
    loading.value = false;
  }

  setInterval(async () => {
    const stat = await mediaConn.getProducerstatistic("video");
    stats.value = stat;
  }, 1000);
});

onUnmounted(() => {
  room.removeSocketListeners();
  handleBeforeUnload(socket);
  mediaConn.close();
});

async function leave() {
  await navigateTo("/");
}
</script>

<template>
  <Transition @afterLeave="showContent = true">
    <LoadingIcon
      :loading-text="loadingStep"
      v-if="loading"
      class="w-full h-full flex justify-center items-center"
    />
  </Transition>

  <RoomError v-if="error" :message="error" />

  <div v-else-if="!error && !loading">
    <div class="w-full flex justify-center">
      <video
        v-if="room.refs.pinnedStream?.value?.stream"
        :srcObject="room.refs.pinnedStream.value.stream"
        autoplay
        playsinline
        class="rounded-lg object-cover shadow max-w-[780px]"
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

    <div class="p-4 bg-black/60 rounded-lg text-xs max-h-[300px] overflow-auto">
      <div v-for="(val, key) in stats" :key="key" class="mb-3">
        <p class="text-red-700 font-mono mb-1">
          <strong>{{ val[1].type }}:</strong>
        </p>
        <ul class="ml-4 text-red-400 font-mono list-disc">
          <li v-for="(v, k) in val[1]" :key="k">
            <span class="text-red-500">{{ k }}:</span> {{ v }}
          </li>
        </ul>
      </div>
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
