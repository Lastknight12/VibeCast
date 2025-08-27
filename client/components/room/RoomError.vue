<script setup lang="ts">
const reload = () => window.location.reload();
defineProps<{ message: string }>();
</script>

<template>
  <div class="flex justify-center items-center w-full h-full flex-col gap-2">
    <p class="text-2xl">{{ message }}</p>
    <UiButton @click="reload" variant="secondary">Reload</UiButton>
  </div>
</template>
