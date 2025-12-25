<script lang="ts" setup>
const props = defineProps<{
  text?: string;
  lineWidth?: string;
  lineHeight?: string;
}>();
</script>

<template>
  <div class="flex gap-2">
    <div
      class="w-2 h-10 bg-yellow-300 rounded-2xl bounce"
      :style="{
        animationDelay: `${index * 0.1}s`,
        width: `${props.lineWidth ?? 8}px`,
        height: `${props.lineHeight ?? 40}px`,
      }"
      v-for="(_item, index) in Array(6).fill(null)"
      :key="index"
    />
  </div>
  <p class="text-3xl text-gray-300">{{ text }}</p>
</template>

<style>
@keyframes bounce {
  0% {
    transform: translateY(0);
  }
  20% {
    transform: translateY(-60%);
  }
  40% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(0);
  }
}
.bounce {
  animation: bounce 1s cubic-bezier(0.77, 0, 0.175, 1) infinite;
}
</style>
