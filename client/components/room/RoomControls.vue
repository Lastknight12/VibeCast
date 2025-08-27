<script setup lang="ts">
const emit = defineEmits<{
  (e: "leave"): void;
}>();

const route = useRoute();
const roomId = route.params.roomId as string;

const mediaConn = useMediasoup();
const media = useMedia(mediaConn);

const room = useRoom(roomId);
</script>

<template>
  <div class="fixed bottom-3 left-1/2 -translate-x-1/2 flex gap-3">
    <UiButton @click="media.toggleMicState" variant="secondary" size="icon">
      <Icon
        :name="
          media.isMuted.value
            ? 'famicons:mic-off-outline'
            : 'famicons:mic-outline'
        "
        size="20"
      />
    </UiButton>

    <UiButton
      @click="media.toggleScreenShare"
      :variant="media.videoStream.value ? 'destructive' : 'secondary'"
      size="icon"
    >
      <Icon
        :name="
          media.videoStream.value
            ? 'ic:outline-stop-screen-share'
            : 'ic:outline-screen-share'
        "
        size="20"
      />
    </UiButton>

    <UiButton
      @click="emit('leave')"
      variant="destructive"
      size="icon"
      class="text-red-200"
    >
      <Icon name="material-symbols-light:call-end" size="20" />
    </UiButton>

    <UiButton
      v-if="room.refs.pinnedStream.value?.stream"
      @click="
        room.userActions.stopWatchingStream(
          room.refs.pinnedStream.value!.peerId!
        )
      "
      variant="destructive"
      size="icon"
      class="text-red-200"
    >
      <Icon name="material-symbols-light:mimo-disconnect-outline" size="20" />
    </UiButton>
  </div>
</template>
