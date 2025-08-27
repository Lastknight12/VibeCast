<script setup lang="ts">
import CreateRoomDialog from "~/components/CreateRoomDialog.vue";
import type { User } from "better-auth/types";
import type { SocketCallback } from "~/composables/useSocket";

useHead({
  title: "VibeCast homepage",
  meta: [
    {
      name: "description",
      content:
        "VibeCast is a video conferencing app where you can create a room and invite your friends to speak together!",
    },
  ],
});

const socket = useSocket();
const authClient = useAuthClient();

const session = await authClient.useSession(useCustomFetch);

const rooms = ref<
  Map<
    string,
    { name: string; peers: Map<string, Pick<User, "id" | "name" | "image">> }
  >
>(new Map());

const googleLogin = () => {
  authClient.signIn.social({
    provider: "google",
  });
};

interface RoomInfo {
  name: string;
  peers: Map<string, User>;
}
const handleRooms: SocketCallback<Record<string, RoomInfo>> = ({ data }) => {
  if (data) {
    const map = new Map<string, RoomInfo>();

    for (const [roomId, room] of Object.entries(data)) {
      map.set(roomId, {
        ...room,
        peers: new Map(Object.entries(room.peers)),
      });
    }
    rooms.value = map;
  }
};

const handleUserJoin = (
  roomId: string,
  peer: Pick<User, "id" | "name" | "image">
) => {
  const room = rooms.value.get(roomId);

  if (!room) {
    console.log("no room with name" + roomId + "exist");
  }

  room?.peers.set(peer.id, peer);
};

const handleUserLeft = (roomId: string, peerId: string) => {
  const room = rooms.value.get(roomId);

  if (!room) {
    console.log("no room with name" + roomId + "exist");
  }

  room?.peers.delete(peerId);
};

const handleRoomCreated = (data: { name: string; id: string }) => {
  rooms.value.set(data.id, { name: data.name, peers: new Map() });
};

const handleRoomDeleted = (roomId: string) => {
  rooms.value.delete(roomId);
};

onMounted(() => {
  socket.emit("getAllRooms", handleRooms);
  socket.on("userJoinRoom", handleUserJoin);
  socket.on("userLeftRoom", handleUserLeft);
  socket.on("roomCreated", handleRoomCreated);
  socket.on("roomDeleted", handleRoomDeleted);
});

onUnmounted(() => {
  socket.off("getAllRooms", handleRooms);
  socket.off("userJoinRoom", handleUserJoin);
  socket.off("userLeftRoom", handleUserLeft);
  socket.off("roomCreated", handleRoomCreated);
  socket.off("roomDeleted", handleRoomDeleted);
});
</script>

<template>
  <Toaster />

  <div class="overflow-hidden relative h-full">
    <div
      ref="ballRef"
      class="w-screen h-[500px] rounded-full absolute -top-1/4 left-1/2 -translate-x-1/2 -z-[10] blur-[140px]"
      style="background: #fed8371c"
    />
    <header
      class="flex items-center justify-between py-4 px-8 border-b border-b-secondary backdrop-blur-[150px]"
    >
      <h1 class="text-secondary text-xl">VibeCast</h1>

      <CreateRoomDialog v-if="session.data.value" />
      <UiButton variant="secondary" size="sm" v-else @click="googleLogin">
        Sign in with Google
      </UiButton>
    </header>

    <div
      class="mt-6 grid gap-8 p-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      <div
        v-if="rooms.size > 0"
        v-for="[roomId, room] of rooms"
        :key="roomId"
        class="p-6 bg-[#070707] border border-border rounded-xl"
        @click="() => navigateTo(`/rooms/${roomId}?name=${room.name}`)"
      >
        <h1 class="text-lg text-secondary">
          {{ room.name }}
        </h1>
        <div
          class="flex flex-wrap gap-2 mt-4"
          v-for="[id, peer] of room.peers"
          :key="id"
        >
          <div
            class="flex items-center bg-[#161616] gap-2 py-2 px-3 rounded-md"
          >
            <img
              :src="peer.image!"
              :alt="peer.name + 'avatar'"
              width="30"
              height="30"
              class="rounded-full"
            />
            <span>{{ peer.name }}</span>
          </div>
        </div>
      </div>

      <div v-else class="col-start-1 col-end-[-1] text-center">
        No rooms created
      </div>
    </div>
  </div>
</template>
