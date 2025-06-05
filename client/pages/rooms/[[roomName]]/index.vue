<script setup lang="ts">
import { useRoom } from "~/composables/room";

const authClient = useAuthClient();
const { data: session } = await authClient.getSession();

const route = useRoute();
const roomName = route.params.roomName as string;

const activeSpeakers = ref<Set<string>>(new Set());
const mediaConn = new mediasoupConn(roomName, activeSpeakers);
const room = useRoom(roomName, mediaConn);
const pinnedVideoStream = ref<{ stream: MediaStream; peerId: string } | null>(
  null
);

const clicked = ref<boolean>(false);

watch(clicked, async (userInteract) => {
  if (userInteract) {
    room.userActions.joinRoom();
  }
});

onMounted(() => {
  if (!session) {
    navigateTo("/");
    return;
  }

  window.addEventListener(
    "beforeunload",
    room.clearFunctions.handleBeforeUnload
  );
  room.registerSocketListeners();
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
</script>

<template>
  <div
    v-if="room.refs.disconnected.value"
    class="flex justify-center items-center w-full h-full flex-col gap-2"
  >
    <p class="text-2xl">You joined on another device</p>
    <UiButton @click="reload" variant="secondary">Reload</UiButton>
  </div>

  <div
    v-else-if="room.refs.joinRoomErrorMessage.value"
    class="flex justify-center items-center w-full h-full flex-col gap-2"
  >
    <p class="text-2xl text-red-400">
      {{ room.refs.joinRoomErrorMessage.value }}
    </p>
    <UiButton @click="reload" variant="secondary">Reload</UiButton>
  </div>

  <div v-else>
    <div
      v-if="!clicked"
      @click="
        () => {
          clicked = true;
        }
      "
      class="absolute top-0 left-0 w-full h-full bg-black z-10 flex justify-center items-center text-white text-2xl"
    >
      Click in any place
    </div>

    <div class="overflow-auto w-full" v-else>
      <div class="w-full flex justify-center">
        <video
          v-if="pinnedVideoStream?.stream"
          :srcObject="pinnedVideoStream.stream"
          @click="
            () => {
              pinnedVideoStream = null;
            }
          "
          ref="localVideo"
          autoplay
          playsinline
          class="w-full h-full object-cover rounded-lg shadow max-w-[780px]"
        ></video>
      </div>
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr p-4"
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
            ref="localVideo"
            :srcObject="room.refs.localStream.value"
            autoplay
            playsinline
            class="w-full h-full object-cover rounded-lg shadow"
          ></video>

          <img
            v-else
            :src="session?.user.image!"
            width="60"
            height="60"
            class="rounded-full"
          />
        </div>

        <div
          v-for="[id, data] in room.refs.peers.value"
          :key="id"
          :class="[
            'bg-[#0f0f0f] transition-all relative rounded-lg flex items-center justify-center min-h-[180px] min-w-[240px]',
            room.refs.activeSpeakers.value.has(id)
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

          <video
            v-if="data.stream?.video && pinnedVideoStream?.peerId !== id"
            @click="
              () => {
                pinnedVideoStream = {stream: data.stream?.video!, peerId: id};
              }
            "
            :srcObject="data.stream.video"
            autoplay
            playsinline
            class="w-full h-full object-cover rounded-lg shadow"
          ></video>

          <img
            v-else
            :src="data.userData.image!"
            width="60"
            height="60"
            class="rounded-full"
          />

          <audio
            v-if="data.stream?.audio"
            :srcObject="data.stream.audio"
            autoplay
          />
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
    </div>
  </div>
</template>
