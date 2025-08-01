<script setup lang="ts">
const toaster = useToast();

const icons: Record<Toast["label"], { name: string; color: string }> = {
  sucess: { name: "lets-icons:check-fill", color: "#61d345" },
  error: { name: "material-symbols:error", color: "#ff4b4b" },
};
</script>

<template>
  <div
    class="fixed w-full px-2 top-3 left-1/2 -translate-x-1/2 z-90 pointer-events-none"
  >
    <transition-group
      name="fade"
      tag="div"
      class="flex flex-col gap-2.5 items-center"
    >
      <div
        v-for="toast in toaster.toasts.value"
        class="bg-[#2b2b2b] px-3.5 py-2 rounded-xl shadow-2x max-w-max"
        :key="toast.id"
      >
        <div class="flex items-center">
          <Icon
            :name="icons[toast.label].name"
            :style="{ color: icons[toast.label].color }"
            class="min-w-[20px] min-h-[20px]"
          />
          <p class="ml-[10px]">{{ toast.message }}</p>
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
  transition: opacity 0.3s ease, transform 0.3s ease;
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
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
