const readline = require("readline");

const clients = ["ws://localhost:3677"];
const sockets = [];

clients.forEach((client) => {
  const socket = new WebSocket("ws://localhost:3677");

  socket.addEventListener("open", (event) => {
    console.log(`connected to ${client}`);
    sockets.push(socket);
  });

  socket.addEventListener("close", (event) => {
    console.log(
      `WebSocket (${client}) connection closed:`,
      event.code,
      event.reason
    );
  });

  socket.addEventListener("error", (error) => {
    console.error(`WebSocket (${client}) error:`, error);
  });
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "cmd> ",
});

rl.prompt();

rl.on("line", async (line) => {
  const command = line.split(" ");
  if (command[0] === "health") {
    sockets.forEach((socket, i) => {
      let answered = false;
      const handler = (event) => {
        const msg = event.data;
        if (msg === "pong") {
          console.log(`✅ socket ${i} відповів`);
          answered = true;
        }
        // Зняти слухача після першого виклику
        socket.removeEventListener("message", handler);
      };

      // Додати одноразовий слухач
      socket.addEventListener("message", handler);

      // Надіслати запит
      socket.send("ping");

      // Таймаут, якщо не відповів
      setTimeout(() => {
        if (!answered) {
          socket.removeEventListener("message", handler);
          console.log(`socket ${i} не відповів ${socket.ip}`);
        }
      }, 3000);
    });
  } else if (command[0] === "spawn") {
    console.log("Спавним браузер...");
    sockets[command[1] - 1].send("spawn");
  } else if (command === "exit") {
    process.exit(0);
  } else {
    console.log(`Невідома команда: ${command}`);
  }

  rl.prompt();
}).on("close", () => {
  process.exit(0);
});
