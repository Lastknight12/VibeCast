<script setup lang="ts">
import type { UseFetchOptions } from "#app";

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

const authClient = useAuthClient();

function useCustomFetch(path: string, opts?: UseFetchOptions<any>) {
  return useFetch(path, {
    baseURL: opts?.baseURL ?? useRuntimeConfig().public.backendUrl,
    headers: opts?.headers ?? useRequestHeaders(),
    credentials: "include",
    ...opts,
  });
}

const { data: authData } = await authClient.useSession(useCustomFetch);

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

function handleBeforeUnload() {
  if (!isDisconnected.value && !error.value) {
    const { errors } = useSocketEmit("leave");
    if (errors.value) {
      toast.error({ message: errors.value[0]?.message });
    }
  }
}

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
});

onUnmounted(() => {
  mediaConn.close();
  room.cleanup();
  handleBeforeUnload();
});

async function leave() {
  await navigateTo("/");
}
</script>

<template>
  <RoomChat :room-id="roomId" />

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
            room.refs.pinnedStream.value.peerId,
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
@keyframes show-chat {
  from {
    opacity: 0;
  }
  to {
    opacity: 100%;
  }
}

.chat-enter-active {
  animation: show-chat 0.3s ease-in forwards;
}

.chat-leave-active {
  animation: show-chat 0.3s ease-in reverse forwards;
}
</style>
