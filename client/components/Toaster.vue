<script setup lang="ts">
const toaster = useToast();
const socket = useSocket();

const icons: Record<Toast["label"], { name: string; color: string }> = {
  sucess: { name: "lets-icons:check-fill", color: "#61d345" },
  error: { name: "material-symbols:error", color: "#ff4b4b" },
};

onMounted(() => {
  socket.on("error", async (error: { code: string; message: string }) => {
    toaster.error({ message: error.message });
  });
});
</script>

<template>
  <div
    class="fixed w-full top-3 left-1/2 -translate-x-1/2 z-90 pointer-events-none"
  >
    <transition-group
      name="fade"
      tag="div"
      class="flex flex-col gap-2.5 items-center"
    >
      <div
        v-for="[id, toast] in toaster.toasts.value"
        class="bg-[#2b2b2b] mx-2 px-3 py-2 rounded-xl shadow-2x max-w-max pointer-events-auto"
        :key="id"
      >
        <div class="flex items-center gap-2">
          <Icon
            :name="icons[toast.label].name"
            :style="{ color: icons[toast.label].color }"
            class="min-w-5 min-h-5"
          />
          <p>{{ toast.message }}</p>
          <button
            class="flex items-center justify-center p-1 rounded-full hover:bg-white/10 transition-colors"
            size="icon"
            variant="link"
            @click="toaster.toasts.value.delete(id)"
          >
            <Icon
              name="lets-icons:close-round"
              size="15"
              class="text-gray-300/90"
            />
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style>
.fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.fade-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
