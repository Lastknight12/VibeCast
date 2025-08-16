<script setup lang="ts">
const route = useRoute();
const roomId = route.params.roomId as string;

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

const toast = useToast();

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

const authClient = useAuthClient();
const { data: session } = await authClient.getSession();

// SUGGESTION: dont accept toast?
const mediaConn = new mediasoupConn(toast);
const room = useRoom(roomId, mediaConn);

watchEffect(() => {
  useHead({
    title: `"${route.params.roomName}" | ${
      room.refs.peers.value.size + 1
    } peers`,
  });
});

onMounted(async () => {
  if (!session) {
    navigateTo("/");
    return;
  }

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

function reload() {
  window.location.reload();
}

async function leave() {
  await navigateTo("/");
}
</script>

<template>
  <Transition @afterLeave="showContent = true">
    <div
      v-if="loading"
      class="w-full h-full relative flex justify-center items-center overflow-hidden"
    >
      <LoadingIcon />
    </div>
  </Transition>

  <div
    v-if="canShowError"
    class="flex justify-center items-center w-full h-full flex-col gap-2"
  >
    <p class="text-2xl">
      {{
        room.refs.disconnected.value
          ? "You have joined on another device."
          : room.refs.joinRoomErrorMessage.value
      }}
    </p>
    <UiButton @click="reload" variant="secondary">Reload</UiButton>
  </div>

  <div v-if="canShowContent">
    <div class="overflow-auto w-full">
      <div class="w-full flex justify-center">
        <video
          v-if="room.refs.localPinnedStreams.value?.stream"
          :srcObject="room.refs.localPinnedStreams.value.stream"
          @click="() => (room.refs.localPinnedStreams.value = null)"
          autoplay
          playsinline
          class="w-full h-full object-cover rounded-lg shadow max-w-[780px]"
        />
      </div>
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-[510px]:grid-cols-1 gap-4 auto-rows-fr p-4"
      >
        <div
          :class="[
            'bg-[#0f0f0f] transition-all relative rounded-lg flex items-center justify-center min-h-[180px] min-w-[240px]',
            room.refs.isSpeaking.value ? 'ring-4 ring-green-400' : '',
          ]"
        >
          <div
            class="absolute bottom-2 right-3 flex gap-3 items-center bg-[#1c1c1c] px-2.5 py-1 rounded-md"
          >
            <Icon
              name="famicons:mic-off-outline"
              size="20"
              v-if="room.refs.muted.value"
            />
            <Icon name="famicons:mic-outline" size="20" v-else />

            <p>{{ session?.user.name }}</p>
          </div>

          <video
            v-if="room.refs.localStream.value"
            :srcObject="room.refs.localStream.value"
            autoplay
            playsinline
            class="w-full h-full object-cover rounded-lg shadow"
          />

          <img
            v-else
            :src="session?.user.image!"
            width="60"
            height="60"
            class="rounded-full"
          />
        </div>

        <div
          v-for="[peerId, data] in room.refs.peers.value"
          :key="peerId"
          :class="[
            'bg-[#0f0f0f] transition-all relative rounded-lg flex items-center justify-center min-h-[180px] min-w-[240px]',
            room.refs.activeSpeakers.value.has(peerId)
              ? 'ring-4 ring-green-400'
              : '',
          ]"
        >
          <div
            class="absolute bottom-2 right-3 flex gap-3 items-center bg-[#1c1c1c] px-2.5 py-1 rounded-md"
          >
            <Icon
              name="famicons:mic-off-outline"
              size="20"
              v-if="data.voiceMuted"
            />
            <Icon name="famicons:mic-outline" size="20" v-else />

            <p>{{ data.userData.name }}</p>
          </div>

          <div
            v-if="
              data.streams?.screenShare.video.producerId &&
              !data.streams.screenShare.active
            "
            class="w-full h-full flex items-center justify-center"
          >
            <UiButton
              variant="secondary"
              @click="room.userActions.watchStream(peerId)"
              >Watch stream</UiButton
            >
          </div>

          <video
            v-else-if="
              data.streams.screenShare?.active &&
              data.streams.screenShare.video.stream &&
              room.refs.localPinnedStreams.value?.peerId !== peerId
            "
            class="w-full h-full rounded-lg"
            @click="() => room.userActions.pinStream(peerId)"
            autoplay
            playsinline
            :srcObject="data.streams.screenShare.video.stream"
          ></video>

          <!-- <video
            v-if="
            data.stream?.screenShare &&
            room.refs.localPinnedStream.value?.peerId !== id
            "
            @click="() => room.userActions.pinStream(id, data.stream.screenShare!.video)"
            :srcObject="data.stream.screenShare.video"
            autoplay
            playsinline
            class="w-full h-full rounded-lg"
            /> -->

          <img
            v-else
            :src="data.userData.image!"
            width="60"
            height="60"
            class="rounded-full"
          />
          <!-- user mic audio -->
          <audio
            v-if="data.streams?.audio.stream"
            :srcObject="data.streams.audio.stream"
            autoplay
          />

          <!-- stream audio -->
          <audio
            v-if="data.streams?.screenShare?.audio?.stream"
            :srcObject="data.streams.screenShare.audio.stream"
            autoplay
          />
          <!-- <audio
          v-if="data.stream?.screenShare?.audio"
          :srcObject="data.stream.screenShare.audio"
          autoplay
          /> -->
        </div>
      </div>
    </div>

    <div class="fixed bottom-3 left-1/2 -translate-x-1/2 flex gap-3">
      <UiButton
        variant="secondary"
        size="icon"
        @click="room.userActions.switchMic"
      >
        <Icon
          name="famicons:mic-off-outline"
          size="20"
          v-if="room.refs.muted.value"
        />
        <Icon name="famicons:mic-outline" size="20" v-else />
      </UiButton>

      <UiButton
        :variant="room.refs.localStream.value ? 'destructive' : 'secondary'"
        @click="room.userActions.switchScreenShare"
        size="icon"
      >
        <Icon
          name="ic:outline-screen-share"
          size="20"
          v-if="!room.refs.localStream.value"
        />
        <Icon name="ic:outline-stop-screen-share" size="20" v-else />
      </UiButton>

      <UiButton
        variant="destructive"
        size="icon"
        class="text-red-200"
        @click="leave"
      >
        <Icon name="material-symbols-light:call-end" size="20" />
      </UiButton>

      <UiButton
        v-if="room.refs.localPinnedStreams.value"
        variant="destructive"
        size="icon"
        class="text-red-200"
        @click="() => room.userActions.stopWatchingStream(room.refs.localPinnedStreams.value!.peerId)"
      >
        <Icon name="material-symbols:mimo-disconnect-outline" size="20" />
      </UiButton>
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
