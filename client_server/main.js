const WebSocket = require("ws");
const puppeteer = require("puppeteer");
const cloudinary = require("cloudinary").v2;
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let roomName = "A";
let roomCreated = false;
let nextClientId = 1;

const wss = new WebSocket.Server({ port: 3677, host: "0.0.0.0" });
console.log("WebSocket server is running on ws://localhost:3677");

let browsers = []; // [{ id, browser }]
let pages = []; // [{ id, page }]
const clientStats = new Map(); // id -> { producing, consumed }
// const absolutePath = path.resolve("./output.y4m");

async function spawnBrowser() {
  const id = nextClientId++;
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // `--use-file-for-fake-video-capture=${absolutePath}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto("http://localhost:3000");

  browsers.push({ id, browser });
  pages.push({ id, page });
  clientStats.set(id, { producing: false, consumed: 0 });

  if (roomCreated) {
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
    roomCreated = true;
  }

  console.log(`Spawned browser client ${id}`);
}

wss.on("connection", (ws) => {
  console.log("Orchestrator connected");

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
        if (isNaN(count) || count <= 0) {
          ws.send("Invalid spawn count");
          return;
        }
        for (let i = 0; i < count; i++) await spawnBrowser();
        ws.send("Successfully spawned browser");
        break;
      }

      case "produce": {
        const clientId = Number(parts[1]);
        const entry = pages.find((p) => p.id === clientId);
        if (!entry) return ws.send(`No page for client ${clientId}`);

        const page = entry.page;
        try {
          const screenShareBtn = await page.waitForSelector(
            "#toggleScreenShare"
          );
          const box = await screenShareBtn.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + 3);

          const stats = clientStats.get(clientId);
          stats.producing = !stats.producing;
          ws.send(`Client ${clientId} producing: ${stats.producing}`);
        } catch (e) {
          ws.send(`Error toggling screen share for ${clientId}: ${e.message}`);
        }
        break;
      }

      case "consume": {
        const clientId = Number(parts[1]);
        const targetId = Number(parts[2]);
        const entry = pages.find((p) => p.id === clientId);
        if (!entry) return ws.send(`No page for client ${clientId}`);

        const page = entry.page;
        try {
          await page.waitForSelector("button");

          const found = await page.$$eval(
            "button",
            (buttons, targetIndex) => {
              const btns = buttons.filter((b) =>
                b.textContent.includes("Watch Stream")
              );
              const btn = btns[targetIndex - 1];
              if (btn) {
                btn.click();
                return true;
              }
              return false;
            },
            targetId
          );

          if (!found) {
            ws.send(`No user with id ${targetId} producing`);
            return;
          }

          const stats = clientStats.get(clientId);
          stats.consumed += 1;
          ws.send(`Client ${clientId} consumed from ${targetId}`);
        } catch (err) {
          ws.send(`Consume error: ${err.message}`);
        }
        break;
      }

      case "removeClient": {
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

      case "unconsume": {
        const clientId = Number(parts[1]);
        const targetId = Number(parts[2]);

        if (targetId === 0) return ws.send("id 0 is taken by user local video");

        const pageEntry = pages.find((p) => p.id === clientId);
        if (!pageEntry) return ws.send(`No page for client ${clientId}`);

        const page = pageEntry.page;
        const stats = clientStats.get(clientId);
        if (!stats) return ws.send(`No stats for client ${clientId}`);

        try {
          await page.waitForSelector("video");

          const clicked = await page.$$eval(
            "video",
            (videos, { targetId, producing }) => {
              const index = targetId;
              const vid = videos[index];
              if (!vid) return false;
              vid.click();
              return true;
            },
            { targetId, producing: stats.producing }
          );

          if (!clicked) {
            ws.send(`No video found for target ${targetId}`);
            return;
          }

          // Step 2: wait for the unwatch button and click it
          await page.waitForSelector("button#unwatch", { timeout: 5000 });
          await page.click("button#unwatch");

          stats.consumed--;
          clientStats.set(clientId, stats);
          ws.send(`Client ${clientId} stopped consuming from ${targetId}`);
        } catch (err) {
          ws.send(`Unconsume error: ${err.message}`);
        }

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
