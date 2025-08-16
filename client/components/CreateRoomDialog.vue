<script lang="ts" setup>
import { cn } from "@/lib/utils";
import type { SocketCallbackArgs } from "~/composables/useSocket";

const socket = useSocket();

const roomName = ref<string>("");
const isPrivate = ref<boolean>(true);

const errorMessage = ref<string | null>(null);

function createRoom() {
  if (roomName.value.trim() === "") {
    errorMessage.value = "Room name cannot be empty";
    return;
  }

  const safeInputRegexp = /^(?!.*\.\.)[a-zA-Z0-9/_\-.]+$/;
  if (!safeInputRegexp.test(roomName.value)) {
    errorMessage.value = "Invalid room name";
    return;
  }

  socket.emit(
    "createRoom",
    {
      roomName: roomName.value.toString(),
      roomType: isPrivate.value === true ? "private" : "public",
    },
    (response: SocketCallbackArgs<{ id: string }>) => {
      if (!response.errors) {
        navigateTo(`/rooms/${response.data.id}`);
        roomName.value = "";
      } else {
        errorMessage.value = response.errors[0]?.message!;
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
        <DialogDescription> Write the name of the room </DialogDescription>
      </UiDialogHeader>
      <div class="py-4">
        <div class="flex flex-col gap-2 mb-4">
          <UiLabel
            for="name"
            class="text-right"
            :class="cn(errorMessage && 'text-red-400')"
          >
            Name{{ errorMessage && `: ${errorMessage}` }}
          </UiLabel>
          <UiInput
            v-model="roomName"
            class="col-span-3"
            :class="cn(errorMessage && 'border-red-400')"
          />
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
