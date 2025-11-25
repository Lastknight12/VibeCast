const WebSocket = require("ws");
const puppeteer = require("puppeteer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const server = "http://localhost:3000";
let roomName = "A";
let nextClientId = 1;

const wss = new WebSocket.Server({ port: 3677, host: "0.0.0.0" });
console.log("WebSocket server is running on ws://localhost:3677");

let browsers = []; // [{ id, browser }]
let pages = []; // [{ id, page }]
const clientStats = new Map(); // id -> { producing, consumed }

async function spawnBrowser(id, isRoomCreated, ws) {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--unsafely-treat-insecure-origin-as-secure=${server}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${server}?userName=${id}`);

  browsers.push({ id, browser });
  pages.push({ id, page });
  clientStats.set(id, { producing: false, consumed: 0 });

  if (isRoomCreated) {
    await page.waitForSelector(`#room-${roomName}`);
    await page.click(`#room-${roomName}`);
  } else {
    await page.waitForSelector("#createRoomBtn");
    await page.click("#createRoomBtn");
    await page.waitForSelector("#roomNameInput");
    await page.type("#roomNameInput", roomName);
    await page.waitForSelector("#isPrivateSwitch");
    await page.click("#isPrivateSwitch");
    await page.waitForSelector("#createBtn");
    await page.click("#createBtn");
    ws.send(`/roomCreated ${roomName}`);
  }

  try {
    const screenShareBtn = await page.waitForSelector("#toggleScreenShare");
    const box = await screenShareBtn.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 3);

    const stats = clientStats.get(clientId);
    stats.producing = !stats.producing;
    // ws.send(`Client ${clientId} producing: ${stats.producing}`);
  } catch (e) {
    // ws.send(`Error toggling screen share for ${clientId}: ${e.message}`);
  }

  pages.forEach(async (page) => {
    try {
      await page.page.waitForSelector('button[id^="watch"]');
      const buttons = await page.page.$$(`button[id^="watch"]`);
      for (const btn of buttons) {
        if (btn) {
          await btn.click();
        }
      }
    } catch (err) {
      console.log(err.message);
    }
  });

  console.log(`Spawned browser client ${id}`);
}

wss.on("connection", (ws) => {
  console.log("Orchestrator connected");
  ws.send(`/myRoom ${roomName}`);

  ws.on("message", async (msg) => {
    const parts = msg.toString().trim().split(" ");
    const cmd = parts[0];

    if (!cmd) return;

    switch (cmd) {
      case "ping":
        ws.send("pong");
        break;

      case "setRoomName":
        roomName = parts[1] || roomName;
        break;

      case "spawn": {
        const count = Number(parts[1]);
        const generatorId = Number(parts[2]);
        const isRoomCreated = JSON.parse(parts[3]);

        if (isNaN(count) || count <= 0) {
          ws.send("Invalid spawn count");
          return;
        }
        for (let i = 0; i < count; i++) {
          await spawnBrowser(
            `${generatorId}-${nextClientId}`,
            isRoomCreated,
            ws
          );
          nextClientId++;
        }
        ws.send("Successfully spawned browser");
        break;
      }

      case "remove": {
        const clientId = Number(parts[1]);
        const entry = browsers.find((b) => b.id === clientId);
        if (!entry) return ws.send(`No browser for client ${clientId}`);

        if (browsers.length === 1) roomCreated = false;

        await entry.browser.close();
        browsers = browsers.filter((b) => b.id !== clientId);
        pages = pages.filter((p) => p.id !== clientId);
        clientStats.delete(clientId);
        ws.send(`Removed client ${clientId}`);
        break;
      }

      case "list": {
        const list = Array.from(clientStats.entries()).map(([id, s]) => ({
          clientId: id,
          producing: s.producing,
          consumed: s.consumed,
        }));
        ws.send(JSON.stringify(list));
        break;
      }

      case "record": {
        const clientId = Number(parts[1]);
        const targetId = Number(parts[2]);
        if (targetId <= 0)
          return ws.send("Invalid targetId: cannot record local video");

        const pageEntry = pages.find((p) => p.id === clientId);
        if (!pageEntry) return ws.send(`No page for client ${clientId}`);

        const page = pageEntry.page;

        try {
          const base64 = await page.evaluate(
            async (targetId) => {
              const videos = document.querySelectorAll("video");
              const target = videos[targetId];
              if (!target) throw new Error("Video element not found");

              const stream = target.captureStream();
              const recorder = new MediaRecorder(stream, {
                mimeType: "video/webm",
              });

              const chunks = [];
              recorder.ondataavailable = (e) =>
                e.data.size && chunks.push(e.data);
              recorder.start();

              await new Promise((r) => setTimeout(r, 10_000));

              recorder.stop();
              await new Promise((r) => (recorder.onstop = r));

              const blob = new Blob(chunks, { type: "video/webm" });
              const arrayBuffer = await blob.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ""
                )
              );

              return base64; // send back to Node for upload
            },
            targetId,
            10
          );
          const buffer = Buffer.from(base64, "base64");
          const res = await cloudinary.uploader.upload_stream(
            { resource_type: "video" },
            (error, result) => {
              if (error) console.error("Cloudinary upload error:", error);
              else {
                console.log("Uploaded:", result.secure_url);
                ws.send(`Uploaded: ${result.secure_url}`);
              }
            }
          );

          const stream = require("stream");
          const readable = new stream.PassThrough();
          readable.end(buffer);
          readable.pipe(res);
        } catch (err) {
          ws.send(`Record error: ${err.message}`);
        }
        break;
      }

      default:
        ws.send(`Unknown command: ${cmd}`);
    }
  });

  ws.on("close", async () => {
    console.log("Orchestrator disconnected");
    for (const { browser } of browsers) await browser.close();
    browsers = [];
    pages = [];
    clientStats.clear();
  });
});
