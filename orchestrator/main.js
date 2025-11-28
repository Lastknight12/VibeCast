const readline = require("readline");
const WebSocket = require("ws");

const clients = ["ws://192.168.119.143:3677"];

const sockets = new Array(clients.length).fill(null);
const createdRooms = [];
const generatorToRoom = new Map();

const roomStreams = new Map();

clients.forEach((client) =>
  generatorToRoom.set(client, { room: "", socket: null })
);

function safeSend(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
}

clients.forEach((client, index) => {
  const socket = new WebSocket(client);

  socket.addEventListener("open", () => {
    console.log(`Connected to ${client}`);
    sockets[index] = socket;
    const info = generatorToRoom.get(client) ?? {};
    generatorToRoom.set(client, { room: info.room ?? "", socket });
  });

  socket.addEventListener("close", (event) => {
    console.log(`WebSocket (${client}) closed:`, event.code, event.reason);
    sockets[index] = null;
    const info = generatorToRoom.get(client) ?? {};
    generatorToRoom.set(client, { room: info.room ?? "", socket: null });
  });

  socket.addEventListener("message", (event) => {
    const data = event.data.toString();

    if (data[0] === "/") {
      const parts = data.split(" ");
      switch (parts[0]) {
        case "/roomCreated": {
          const room = parts[1];
          if (room && !createdRooms.includes(room)) createdRooms.push(room);

          roomStreams.set(room, 0);
          break;
        }

        case "/myRoom": {
          const room = parts[1];
          if (!room) break;

          generatorToRoom.set(client, { room, socket });
          break;
        }

        case "/streamCreated": {
          const roomName = parts[1];
          const creatorId = parts[2];

          let streamsCount = roomStreams.get(roomName) ?? 0;
          roomStreams.set(roomName, streamsCount + 1);
          generatorToRoom.forEach(({ room, socket: otherSocket }) => {
            if (!otherSocket || otherSocket.readyState !== WebSocket.OPEN)
              return;
            if (roomName === room) {
              safeSend(otherSocket, `watch ${creatorId}`);
            }
          });
          break;
        }
      }
    }

    console.log(`    Message from ${client} (${index + 1}):`, data);
  });

  socket.addEventListener("error", (error) => {
    console.error(`WebSocket (${client}) error:`, error.message ?? error);
  });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "",
});
rl.prompt();

function getSocket(id) {
  if (!Number.isInteger(id) || id < 1 || id > sockets.length) {
    console.log(`Invalid generatorId ${id}`);
    return;
  }
  const socket = sockets[id - 1];
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log(`generator ${id} socket not connected`);
    return;
  }
  return socket;
}

rl.on("line", async (line) => {
  const command = line.trim().split(/\s+/);
  const cmd = command[0];
  if (!cmd) return rl.prompt();

  switch (cmd) {
    case "health": {
      sockets.forEach((socket, i) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          console.log(`socket ${i + 1} not connected`);
          return;
        }

        let answered = false;
        const handler = (event) => {
          if (event.data === "pong") {
            console.log(`socket ${i + 1} alive`);
            answered = true;
          }
          socket.removeEventListener("message", handler);
        };

        socket.addEventListener("message", handler);
        safeSend(socket, "ping");

        setTimeout(() => {
          if (!answered) {
            socket.removeEventListener("message", handler);
            console.log(`socket ${i + 1} did not respond`);
          }
        }, 3000);
      });
      break;
    }

    case "exit":
      process.exit(0);

    case "spawn": {
      const generatorId = Number(command[1]);
      const count = Number(command[2]);
      const socket = getSocket(generatorId);
      if (!socket || isNaN(count) || count <= 0) break;

      const info = generatorToRoom.get(clients[generatorId - 1]) ?? {};
      const roomName = info.room;
      if (!roomName) return console.log("Generator has no room assigned yet");

      const streamsInRoom = roomStreams.get(roomName);
      const consumeLocalClients = streamsInRoom >= 1;
      const isRoomCreated = createdRooms.includes(roomName);
      safeSend(
        socket,
        `spawn ${count} ${generatorId} ${isRoomCreated} ${consumeLocalClients}`
      );
      break;
    }

    case "remove": {
      const generatorId = Number(command[1]);
      const clientId = command[2];
      const socket = getSocket(generatorId);
      if (!socket || !clientId) break;
      safeSend(socket, `remove ${clientId}`);
      break;
    }

    case "list": {
      const generatorId = Number(command[1]);
      const socket = getSocket(generatorId);
      if (!socket) break;
      safeSend(socket, "list");
      break;
    }

    case "record": {
      const generatorId = Number(command[1]);
      const clientId = command[2];
      const targetId = Number(command[3]);

      if (targetId === 0)
        return console.log("id 0 is taken by user local video");

      const socket = getSocket(generatorId);
      if (!socket) break;
      safeSend(socket, `record ${clientId} ${targetId}`);
      break;
    }

    default:
      console.log(`Unknown command: ${cmd}`);
  }

  rl.prompt();
}).on("close", () => process.exit(0));
