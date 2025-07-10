import sfuModule from "..";

sfuModule.defineSocketHandler({
  event: "micOff",
  handler(ctx) {
    const { socket, rooms } = ctx;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      console.log("no room exist");
      return;
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log("no peer founded in room");
      return;
    }

    peer.voiceMuted = true;
    socket.broadcast.to(user.roomName).emit("micOff", user.id);
  },
});
