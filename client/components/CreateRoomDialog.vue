<script lang="ts" setup>
import { cn } from "@/lib/utils";
import type { SocketCallbackArgs } from "~/composables/useSocket";

interface Error {
  type: "validation" | "api";
  message: string;
}

const socket = useSocket();
const toast = useToast();

const open = ref(false);
const roomName = ref<string>("");
const isPrivate = ref<boolean>(true);

const error = ref<Error | null>(null);

function createRoom() {
  if (roomName.value.trim() === "") {
    error.value = { type: "validation", message: "Room name cannot be empty" };
    return;
  }

  const safeInputRegexp = /^(?!.*\.\.)[a-zA-Z0-9._~-]+$/;
  if (!safeInputRegexp.test(roomName.value)) {
    error.value = { type: "validation", message: "Invalid room name" };
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
        navigateTo(`/rooms/${response.data.id}?name=${roomName.value}`);
        roomName.value = "";
      } else {
        toast.error({ message: response.errors[0]?.message });
      }
    }
  );
}

function reset() {
  setTimeout(() => {
    roomName.value = "";
    isPrivate.value = true;
    error.value = null;
  }, 150);
}
</script>

<template>
  <UiDialog
    :open="open"
    @update:open="
      () => {
        open = !open;
        if (!open) reset();
      }
    "
  >
    <UiDialogTrigger as-child>
      <UiButton variant="secondary" id="createRoomBtn"> Create Room </UiButton>
    </UiDialogTrigger>
    <UiDialogContent>
      <UiDialogHeader>
        <DialogTitle>Create Room</DialogTitle>
        <DialogDescription> Write the name of the room </DialogDescription>
      </UiDialogHeader>
      <div>
        <div class="flex flex-col gap-2 mb-4">
          <UiLabel
            for="name"
            :class="cn('text-right', error && 'text-red-400')"
          >
            Name: {{ error?.message }}
          </UiLabel>
          <UiInput
            v-model="roomName"
            :class="cn('col-span-3', error && 'border-red-400')"
            id="roomNameInput"
          />
        </div>
        <div class="flex items-center space-x-2">
          <UiSwitch v-model="isPrivate" id="isPrivateSwitch" />
          <UiLabel for="isPrivateSwitch"
            >Private:
            <span :class="cn(isPrivate ? 'text-green-400' : 'text-red-400')">{{
              isPrivate
            }}</span></UiLabel
          >
        </div>
      </div>
      <UiDialogFooter>
        <UiButton
          type="submit"
          variant="secondary"
          @click="createRoom"
          id="createBtn"
        >
          Create
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
