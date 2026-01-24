<script setup lang="ts">
import CreateRoomDialog from "~/components/CreateRoomDialog.vue";
import type { User } from "better-auth/types";

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

const toast = useToast();
const authClient = useAuthClient();
const session = authClient.useSession();

const rooms = reactive<Record<string, Room>>({});
const loading = ref(true);

interface Room {
  name: string;
  peers: RoomPeers;
}

const googleLogin = () => {
  authClient.signIn.social({
    provider: "google",
  });
};

type RoomPeers = Record<string, Pick<User, "id" | "name" | "image">>;

interface RoomInfo {
  id: string;
  name: string;
  peers: User[];
}

const handleRooms = (data: RoomInfo[]) => {
  for (const room of data) {
    const peersObj: RoomPeers = {};
    room.peers.forEach((user) => {
      peersObj[user.id] = { id: user.id, name: user.name, image: user.image };
    });

    rooms[room.id] = {
      name: room.name,
      peers: peersObj,
    };
  }
};

const handleUserJoin = (data: {
  roomId: string;
  userData: Pick<User, "id" | "name" | "image">;
}) => {
  const room = rooms[data.roomId];
  if (!room) return console.log("Room not found:", data.roomId);
  room.peers[data.userData.id] = data.userData;
};

const handleUserLeftRoom = (data: { roomId: string; userId: string }) => {
  const room = rooms[data.roomId];
  if (!room) return console.log("Room not found:", data.roomId);
  delete room.peers[data.userId];
};

const handleRoomCreated = (data: { name: string; id: string }) => {
  rooms[data.id] = reactive({ name: data.name, peers: {} });
};

const handleRoomDeleted = (data: { roomId: string }) => {
  delete rooms[data.roomId];
};

const handleRoomClick = async (roomId: string, roomName: string) => {
  if (!session.value) return toast.error({ message: "Login to join room" });

  await navigateTo(`/rooms/${roomId}?name=${roomName}`);
};

onMounted(() => {
  const socket = useSocket();
  const {
    data: roomsList,
    errors,
    loading: loadingRooms,
  } = useSocketEmit<RoomInfo[]>("getAllRooms");

  watch(loadingRooms, (isLoading) => {
    loading.value = isLoading;
  });

  watch(errors, (val) => {
    if (val)
      toast.error({
        message: `Error while fetching rooms: ${val[0]?.message}`,
      });
  });

  watch(roomsList, (val) => {
    if (val) handleRooms(val);
  });

  socket.on("userJoinRoom", handleUserJoin);
  socket.on("userLeftRoom", handleUserLeftRoom);
  socket.on("roomCreated", handleRoomCreated);
  socket.on("roomDeleted", handleRoomDeleted);
});
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

        <div v-if="session.data" class="flex items-center gap-2">
          <CreateRoomDialog />
          <UiButton
            size="sm"
            variant="destructive"
            @click="authClient.signOut()"
            >Leave</UiButton
          >
        </div>
        <UiButton variant="secondary" size="sm" v-else @click="googleLogin">
          Sign in with Google
        </UiButton>
      </header>

      <div
        class="mt-6 h-[calc(100%-24px-32px-65px)] grid gap-8 p-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      >
        <div
          v-if="Object.keys(rooms).length > 0"
          v-for="(room, roomId) in rooms"
          :key="roomId"
          :id="`room-${room.name}`"
          class="p-6 bg-[#070707] border border-border rounded-xl"
          @click="() => handleRoomClick(roomId, room.name)"
        >
          <h1 :title="room.name" class="text-lg text-secondary">
            {{ truncateString(room.name, 25) }}
          </h1>
          <div
            class="flex flex-wrap gap-2 mt-4"
            v-for="(peer, id) in room.peers"
            :key="id"
          >
            <div
              class="flex items-center bg-[#161616] gap-2 py-2 px-3 rounded-md"
            >
              <img
                :src="peer.image!"
                :alt="peer.name + ' avatar'"
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

        <div
          v-else
          class="col-start-1 -col-end-1 text-center h-full flex items-center justify-center"
        >
          <LoadingIcon v-if="loading">
            <p class="text-xl text-gray-300">Loading rooms...</p>
          </LoadingIcon>
          <p v-else class="text-xl text-gray-300">No rooms created yet</p>
        </div>
      </div>
    </div>
  </KeepAlive>
</template>
