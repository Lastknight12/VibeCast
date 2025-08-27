<script setup lang="ts">
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
const { data: authData } = await authClient.useSession(useCustomFetch);

const loading = ref(true);
const showContent = ref(false);
const hasJoinRoomError = computed(() => !!room.refs.joinRoomErrorMessage.value);
const isDisconnected = computed(() => !!room.refs.disconnected.value);
const canShowError = computed(
  () =>
    (hasJoinRoomError.value || isDisconnected.value) &&
    !loading.value &&
    showContent.value
);
const canShowContent = computed(
  () => showContent.value && !hasJoinRoomError.value && !isDisconnected.value
);

const mediaConn = useMediasoup();
const room = useRoom(roomId);

watchEffect(() => {
  useHead({
    title: `"${roomName}" | ${room.refs.peers.value.size + 1} peers`,
  });
});

onMounted(async () => {
  window.addEventListener(
    "beforeunload",
    room.clearFunctions.handleBeforeUnload
  );
  room.registerSocketListeners();
  try {
    room.userActions.joinRoom();
  } catch (_) {
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  room.clearFunctions.removeSocketListeners();
  window.removeEventListener(
    "beforeunload",
    room.clearFunctions.handleBeforeUnload
  );

  room.clearFunctions.handleBeforeUnload();
  mediaConn.close();
});

async function leave() {
  await navigateTo("/");
}
</script>

<template>
  <Transition @afterLeave="showContent = true">
    <LoadingIcon
      v-if="loading"
      class="w-full h-full flex justify-center items-center"
    />
  </Transition>

  <RoomError
    v-if="canShowError"
    :message="room.refs.joinRoomErrorMessage.value!"
  />

  <div class="w-full flex justify-center">
    <video
      v-if="room.refs.pinnedStream?.value?.stream"
      :srcObject="room.refs.pinnedStream.value.stream"
      autoplay
      playsinline
      class="rounded-lg object-cover shadow max-w-[780px]"
      @click="
        room.userActions.togglePinnedStream(room.refs.pinnedStream.value.peerId)
      "
    ></video>
  </div>

  <div v-if="canShowContent">
    <RoomPeersGrid
      :peers="room.refs.peers.value"
      :active-speakers="room.refs.activeSpeakers.value"
      :pinned-stream="room.refs.pinnedStream"
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
