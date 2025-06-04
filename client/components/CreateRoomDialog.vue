<script lang="ts" setup>
const socket = useSocket();

const roomName = ref<string>("");
const isPrivate = ref<boolean>(true);

function createRoom() {
  if (roomName.value.trim() === "") {
    alert("Room name cannot be empty");
    return;
  }
  socket.emit(
    "createRoom",
    roomName.value,
    isPrivate.value === true ? "private" : "public",
    (response: { error?: string }) => {
      if (!response.error) {
        navigateTo("/rooms/" + roomName.value);
        roomName.value = "";
      } else {
        console.log("Error creating room:", response.error);
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
        <DialogDescription>
          Create a new room by providing a name for it
        </DialogDescription>
      </UiDialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid grid-cols-4 items-center gap-4">
          <UiLabel for="name" class="text-right"> Name </UiLabel>
          <UiInput v-model="roomName" class="col-span-3" />
        </div>
        <div class="flex items-center space-x-2">
          <UiSwitch v-model="isPrivate" id="airplane-mode" />
          <UiLabel for="airplane-mode">Private</UiLabel>
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
