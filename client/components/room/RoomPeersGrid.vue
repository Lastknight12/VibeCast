<script setup lang="ts">
const props = defineProps<{
  peers: Ref<Map<string, Peer>>;
  activeSpeakers: Set<string>;
  pinnedStream: Ref<pinnedStream | null>;
}>();

const emit = defineEmits<{
  (e: "watch-stream", peerId: string): void;
  (e: "pin-stream", peerId: string): void;
}>();
</script>

<template>
  <div
    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr p-4"
  >
    <slot name="localPeer" />

    <RoomPeer
      v-for="[peerId, peer] in peers.value"
      :key="peerId"
      :peer-id="peerId"
      :peer="peer"
      :is-pinned="pinnedStream.value?.peerId === peerId"
      :is-speaking="activeSpeakers.has(peerId)"
      @watch-stream="emit('watch-stream', peerId)"
      @pin-stream="emit('pin-stream', peerId)"
    />
  </div>
</template>
