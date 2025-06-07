<script lang="ts" setup>
import { cn } from "@/lib/utils";

const socket = useSocket();
const router = useRouter();

const roomName = ref<string>("");
const isPrivate = ref<boolean>(true);

const errorMessage = ref<string | null>(null);

function createRoom() {
  if (roomName.value.trim() === "") {
    errorMessage.value = "Room name cannot be empty";
    return;
  }
  socket.emit(
    "createRoom",
    roomName.value,
    isPrivate.value === true ? "private" : "public",
    (response: { error?: string }) => {
      if (!response.error) {
        navigateTo(`/rooms/${roomName.value}`);
        roomName.value = "";
      } else {
        errorMessage.value = response.error;
      }
    }
  );
}
</script>

<template>
  <UiDialog>
    <UiDialogTrigger as-child>
      <UiButton variant="secondary"> Create Room </UiButton>
    </UiDialogTrigger>
    <UiDialogContent class="sm:max-w-[425px]">
      <UiDialogHeader>
        <DialogTitle>Create Room</DialogTitle>
        <DialogDescription
          :class="cn(errorMessage ? 'text-red-400' : 'text-[#969696]')"
        >
          {{ errorMessage ? errorMessage : "Write the name of the room" }}
        </DialogDescription>
      </UiDialogHeader>
      <div class="py-4">
        <div class="flex flex-col gap-2 mb-4">
          <UiLabel for="name" class="text-right"> Name </UiLabel>
          <UiInput v-model="roomName" class="col-span-3" />
        </div>
        <div class="flex items-center space-x-2">
          <UiSwitch v-model="isPrivate" id="airplane-mode" />
          <UiLabel for="airplane-mode"
            >Private:
            <span :class="cn(isPrivate ? 'text-green-400' : 'text-red-400')">{{
              isPrivate
            }}</span></UiLabel
          >
        </div>
      </div>
      <UiDialogFooter>
        <UiButton type="submit" variant="secondary" @click="createRoom">
          Create
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
