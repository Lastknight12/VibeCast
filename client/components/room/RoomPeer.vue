<script setup lang="ts">
const props = defineProps<{
  peer: Peer;
  isSpeaking: boolean;
  isPinned?: boolean;
}>();

const emit = defineEmits<{
  (e: "watch-stream", peerId: string): void;
  (e: "pin-stream", peerId: string): void;
}>();

const socket = useSocket();

const rootEl = ref<HTMLDivElement>();

const hasStream = computed(
  () => props.peer.streams.screenShare.video.producerId
);

onMounted(() => {
  if (rootEl.value) {
    watch(hasStream, (hasStream) => {
      if (
        hasStream &&
        props.peer.userData.id === props.peer.userData.id &&
        !props.isPinned
      ) {
        rootEl.value!.style.backgroundImage = `url(${props.peer.streams.screenShare.thumbnail})`;
        rootEl.value!.style.backgroundSize = "cover";
        rootEl.value!.style.backgroundPosition = "center";
        rootEl.value!.style.backdropFilter = "brightness(0.3)";
      } else {
        rootEl.value!.style.backgroundImage = `unset`;
      }
    });

    if (props.peer.streams.screenShare.thumbnail) {
      rootEl.value.style.backgroundImage = `url(${props.peer.streams.screenShare.thumbnail})`;
      rootEl.value.style.backgroundSize = "cover";
      rootEl.value.style.backgroundPosition = "center";
      rootEl.value.style.backdropFilter = "brightness(0.3)";
    }
    socket.on("new-thumbnail", (url, peerId) => {
      if (hasStream && peerId === props.peer.userData.id && !props.isPinned) {
        rootEl.value!.style.backgroundImage = `url(${url})`;
        rootEl.value!.style.backgroundSize = "cover";
        rootEl.value!.style.backgroundPosition = "center";
        rootEl.value!.style.backdropFilter = "brightness(0.3)";
      }
    });
  }
});
</script>
<template>
  <div
    ref="rootEl"
    class="relative rounded-lg flex items-center justify-center min-h-[180px] min-w-[240px] bg-[#0f0f0f] transition-all"
    :class="{
      'ring-4 ring-green-400': isSpeaking,
    }"
  >
    <div
      v-if="
        peer.streams.screenShare.video.producerId &&
        !peer.streams.screenShare.active
      "
      class="inset-0 flex items-center justify-center bg-black/50"
    >
      <UiButton
        size="sm"
        variant="secondary"
        class="bottom-3"
        @click="emit('watch-stream', peer.userData.id)"
      >
        Watch Stream
      </UiButton>
    </div>

    <video
      v-else-if="
        peer.streams.screenShare.active &&
        !isPinned &&
        peer.streams.screenShare.video.stream
      "
      autoplay
      playsinline
      class="w-full h-full object-cover rounded-lg shadow"
      :srcObject="peer.streams.screenShare.video.stream"
      @click="emit('pin-stream', peer.userData.id)"
    />

    <img
      v-else
      :src="peer.userData.image!"
      width="60"
      height="60"
      class="rounded-full"
    />

    <div
      class="absolute bottom-2 right-3 flex gap-3 items-center bg-[#1c1c1c] px-2.5 py-1 rounded-md"
    >
      <Icon
        :name="
          peer.voiceMuted ? 'famicons:mic-off-outline' : 'famicons:mic-outline'
        "
        size="20"
      />
      <p>{{ peer.userData.name }}</p>
    </div>

    <audio
      v-if="peer.streams.screenShare.audio.stream"
      :srcObject="peer.streams.screenShare.audio.stream"
      autoplay
    />
    <audio
      v-if="peer.streams.audio.stream"
      autoplay
      :srcObject="peer.streams.audio.stream"
    />
  </div>
</template>
