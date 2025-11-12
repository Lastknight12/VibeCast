<script setup lang="ts">
defineProps<{
  peers: Map<string, Peer>;
  activeSpeakers: Set<string>;
  pinnedStream: pinnedStream | null;
}>();

const emit = defineEmits<{
  (e: "watch-stream", peerId: string, cb: () => void): void;
  (e: "pin-stream", peerId: string): void;
}>();
</script>

<template>
  <div
    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr p-4"
  >
    <slot name="localPeer" />

    <RoomPeer
      v-for="[peerId, peer] in peers"
      :key="peerId"
      :peer="peer"
      :is-pinned="pinnedStream?.peerId === peerId"
      :is-speaking="activeSpeakers.has(peerId)"
      @watch-stream="(peerId, cb) => emit('watch-stream', peerId, cb)"
      @pin-stream="emit('pin-stream', peerId)"
    />
  </div>
</template>
