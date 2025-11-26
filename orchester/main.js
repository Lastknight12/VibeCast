const readline = require("readline");
const WebSocket = require("ws");

const clients = ["ws://localhost:3677"];
const sockets = [];

const createdRooms = [];
const generatorToRoom = new Map([]);
clients.forEach((client) => {
  generatorToRoom.set(client, "");
});

clients.forEach((client, index) => {
  const socket = new WebSocket(client);

  socket.addEventListener("open", () => {
    console.log(`Connected to ${client}`);
    sockets[index] = socket;
  });

  socket.addEventListener("close", (event) => {
    console.log(`WebSocket (${client}) closed:`, event.code, event.reason);
  });

  socket.addEventListener("message", (event) => {
    if (event.data[0] === "/") {
      const parts = event.data.split(" ");
      switch (parts[0]) {
        case "/roomCreated": {
          createdRooms.push(parts[1]);
        }
        case "/myRoom": {
          const room = parts[1];
          generatorToRoom.set(client, { room, socket });
        }
        case "/createdStream": {
          const roomName = parts[1];
          generatorToRoom.forEach(({ room, socket }, ip) => {
            if (ip === client) return;
            if (roomName === room) {
              socket.send("watch");
            }
          });
        }
      }
    }
    console.log(`    Message from ${client}:`, event.data);
  });

  socket.addEventListener("error", (error) => {
    console.error(`WebSocket (${client}) error:`, error.message);
  });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "",
});

rl.prompt();

function getSocket(id) {
  const socket = sockets[id - 1];
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log(`❌ Invalid generatorId ${id} or socket not connected`);
    return null;
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
          console.log(`❌ socket ${i} not connected`);
          return;
        }

        let answered = false;
        const handler = (event) => {
          if (event.data === "pong") {
            console.log(`✅ socket ${i + 1} alive`);
            answered = true;
          }
          socket.removeEventListener("message", handler);
        };

        socket.addEventListener("message", handler);
        socket.send("ping");

        setTimeout(() => {
          if (!answered) {
            socket.removeEventListener("message", handler);
            console.log(`⚠️ socket ${i + 1} did not respond`);
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

      const { room: roomName } = generatorToRoom.get(clients[generatorId - 1]);
      if (!roomName) return;

      const isRoomCreated = createdRooms.includes(roomName);
      socket.send(`spawn ${count} ${generatorId} ${isRoomCreated}`);
      break;
    }

    case "remove": {
      const generatorId = Number(command[1]);
      const clientId = Number(command[2]);
      const socket = getSocket(generatorId);
      if (!socket || isNaN(clientId)) break;
      socket.send(`remove ${clientId}`);
      break;
    }

    case "list": {
      const generatorId = Number(command[1]);
      const socket = getSocket(generatorId);
      if (!socket) break;
      socket.send("list");
      break;
    }

    case "unconsume": {
      const generatorId = Number(command[1]);
      const clientId = Number(command[2]);
      const targetId = Number(command[3]);

      if (targetId === 0)
        return console.log("id 0 is taken by user local video");

      const socket = getSocket(generatorId);
      if (!socket) break;
      socket.send(`unconsume ${clientId} ${targetId}`);
      break;
    }

    case "record": {
      const generatorId = Number(command[1]);
      const clientId = Number(command[2]);
      const targetId = Number(command[3]);

      if (targetId === 0)
        return console.log("id 0 is taken by user local video");

      const socket = getSocket(generatorId);
      if (!socket) break;
      socket.send(`record ${clientId} ${targetId}`);
      break;
    }

    default:
      console.log(`❓ Unknown command: ${cmd}`);
  }

  rl.prompt();
}).on("close", () => process.exit(0));
