<script setup lang="ts">
defineProps<{
  userName: string;
  userImage: string;
}>();

const mediaConn = useMediasoup();
const socket = useSocket();
const media = useMedia(mediaConn);
const toast = useToast();

const videoElem = ref<HTMLVideoElement | null>(null);

async function captureFrame(w = 720, h = 360, q = 0.7) {
  if (!import.meta.client || !videoElem.value) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    toast.error({ message: "Error while getting canvas context" });
    return;
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(videoElem.value, 0, 0, w, h);

  canvas.toBlob(
    (blob) => {
      if (blob) {
        socket.emit("uploadThumbnail", {
          imageBuffer: blob.arrayBuffer(),
        });
      } else {
        toast.error({ message: "Failed to get canvas blob" });
      }
    },
    "image/jpeg",
    q
  );
}

watch(videoElem, (val, _, onCleanup) => {
  if (!val) return;

  const handlePlaying = () => {
    captureFrame();

    const interval = setInterval(() => {
      captureFrame();
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
      class="absolute bottom-2 right-3 flex gap-3 items-center bg-[#1c1c1c] px-2.5 py-1 rounded-md"
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
