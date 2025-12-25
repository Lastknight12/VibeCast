<script setup lang="ts">
defineProps<{
  userName: string;
  userImage: string;
}>();

const mediaConn = useMediasoup();
const socket = useSocket();
const media = useMedia(mediaConn);
const snapshot = useSnapshot();

const videoElem = ref<HTMLVideoElement | null>(null);

async function captureFirstFrame() {
  const thumbnailBlob = await snapshot?.captureFrame(videoElem.value!);

  const thumbnailBuffer = await thumbnailBlob?.arrayBuffer();
  thumbnailBuffer &&
    socket.emit("uploadThumbnail", {
      imageBuffer: thumbnailBuffer,
    });
}

watch(videoElem, (val, _, onCleanup) => {
  if (!val) return;

  const handlePlaying = () => {
    captureFirstFrame();

    const interval = setInterval(() => {
      captureFirstFrame();
    }, 15 * 60 * 1000);

    onCleanup(() => clearInterval(interval));
  };

  val.addEventListener("playing", handlePlaying);

  onCleanup(() => {
    val.removeEventListener("playing", handlePlaying);
  });
});
</script>

<template>
  <div
    :class="[
      'bg-[#0f0f0f] relative rounded-lg flex items-center justify-center min-h-[180px] min-w-60',
      media.isSpeaking.value ? 'ring-4 ring-green-400' : '',
    ]"
  >
    <div
      class="absolute z-50 bottom-2 right-3 flex gap-3 items-center bg-[#1c1c1c] px-2.5 py-1 rounded-md"
    >
      <Icon
        :name="
          media.isMuted.value
            ? 'famicons:mic-off-outline'
            : 'famicons:mic-outline'
        "
        size="20"
      />
      <p :title="userName">{{ truncateString(userName, 25) }}</p>
    </div>

    <video
      v-show="media.videoStream.value"
      ref="videoElem"
      :srcObject="media.videoStream.value"
      autoplay
      playsinline
      class="w-full h-full object-cover rounded-lg shadow"
    />
    <img
      v-if="!media.videoStream.value"
      :src="userImage"
      width="60"
      height="60"
      class="rounded-full"
    />
  </div>
</template>
