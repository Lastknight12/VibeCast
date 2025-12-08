<script setup lang="ts">
import CreateRoomDialog from "~/components/CreateRoomDialog.vue";
import type { User } from "better-auth/types";
import type { SocketCallback } from "~/composables/useSocket";
import { generateRandomUser, user } from "~/lib/randomUser";
import { useRoute } from "vue-router";

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
const route = useRoute();
// TODO: remove in pr
const name = route.query["userName"] as string;

onMounted(() => {
  session.data.value = generateRandomUser(name ?? window.crypto.randomUUID());
  const socket = useSocket();
  socket.emit("getAllRooms", handleRooms);
  socket.on("userJoinRoom", handleUserJoin);
  socket.on("userLeftRoom", handleUserLeftRoom);
  socket.on("roomCreated", handleRoomCreated);
  socket.on("roomDeleted", handleRoomDeleted);
});

const toast = useToast();
const authClient = useAuthClient();
const session = { data: ref(user) };

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

const handleUserJoin = (data: {
  roomId: string;
  userData: Pick<User, "id" | "name" | "image">;
}) => {
  const room = rooms.value.get(data.roomId);
  if (!room) {
    console.log("no room with name" + data.roomId + "exist");
  }

  room?.peers.set(data.userData.id, data.userData);
};

const handleUserLeftRoom = (data: { roomId: string; userId: string }) => {
  const room = rooms.value.get(data.roomId);
  if (!room) {
    console.log("no room with name" + data.roomId + "exist");
  }

  room?.peers.delete(data.userId);
};

const handleRoomCreated = (data: { name: string; id: string }) => {
  rooms.value.set(data.id, { name: data.name, peers: new Map() });
};

const handleRoomDeleted = (data: { roomId: string }) => {
  rooms.value.delete(data.roomId);
};

const handleRoomClick = async (roomId: string, roomName: string) => {
  if (!session.data.value)
    return toast.error({ message: "Login to join room" });

  await navigateTo(`/rooms/${roomId}?name=${roomName}`);
};
</script>

<template>
  <KeepAlive>
    <div class="overflow-hidden relative h-full">
      <div
        ref="ballRef"
        class="w-screen h-[500px] rounded-full absolute -top-1/4 left-1/2 -translate-x-1/2 -z-10 blur-[140px]"
        style="background: #fed8371c"
      />
      <header
        class="flex items-center justify-between py-4 px-8 border-b border-b-secondary backdrop-blur-[150px]"
      >
        <h1 class="text-secondary text-xl">VibeCast</h1>

        <div v-if="session.data.value" class="flex items-center gap-2">
          <CreateRoomDialog />
          <UiButton variant="destructive" @click="authClient.signOut()"
            >Leave</UiButton
          >
        </div>
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
          :id="`room-${room.name}`"
          @click="() => handleRoomClick(roomId, room.name)"
        >
          <h1 :title="room.name" class="text-lg text-secondary">
            {{ truncateString(room.name, 25) }}
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
              <span :title="peer.name">{{
                truncateString(peer.name, 15)
              }}</span>
            </div>
          </div>
        </div>

        <div v-else class="col-start-1 -col-end-1 text-center">
          No rooms created
        </div>
      </div>
    </div>
  </KeepAlive>
</template>
