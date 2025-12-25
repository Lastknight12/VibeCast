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
console.log(`WebSocket server is running on ws://0.0.0.0:3677`);

let browsers = []; // [{ id, browser }]
let pages = []; // [{ id, page }]
const clientStats = new Map(); // id -> { producing, consumed }

const REASON_CONSUME_ALL = "consume-all";
const REASON_CONSUME_NEW = "consume-new";
async function watchStream(ws, page, reason) {
  try {
    await page.waitForSelector('button[id^="watch"]');
    const buttons = await page.$$(`button[id^="watch"]`);
    for (const btn of buttons) {
      if (btn) {
        await btn.click();
      }
    }
    console.log(`Client ${page.__clientId} consumed streams: ${reason}`);
    ws.send(`Client ${page.__clientId} consumed streams: ${reason}`);

    const id = page.__clientId;
    const stats = clientStats.get(id);
    if (stats) {
      stats.consumed = buttons.length;
    }
  } catch (err) {
    console.log(err.message);
  }
}

let isSpawning = false;
async function spawnBrowser(ws, id, isRoomCreated, consumeLocalClients) {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--unsafely-treat-insecure-origin-as-secure=${server}`,
    ],
  });

  const page = await browser.newPage();
  page.__clientId = id;
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${server}?userName=${id}`);

  browsers.push({ id, browser });
  pages.push({ id, page });
  clientStats.set(id, { producing: false, consumed: 0 });

  if (consumeLocalClients) watchStream(ws, page, REASON_CONSUME_ALL);

  try {
    const screenShareBtn = await page.waitForSelector("#toggleScreenShare");
    const box = await screenShareBtn.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 3);

    console.log(`Client ${id}: stream created`);
    ws.send(`/streamCreated ${roomName} ${id}`);

    const stats = clientStats.get(id);
    stats.producing = !stats.producing;

    console.log(`Successfully spawned browser for client ${id}`);
  } catch (error) {
    ws.send(`Error toggling screen share for ${id}: ${error.message ?? error}`);
  }

  isSpawning = false;
}

wss.on("connection", (ws) => {
  console.log("Orchestrator connected");
  console.log(`Using room: ${roomName}`);
  ws.send(`/myRoom ${roomName}`);

  ws.on("message", async (msg) => {
    const parts = msg.toString().trim().split(" ");
    const cmd = parts[0];

    if (!cmd) return;

    switch (cmd) {
      case "ping":
        ws.send("pong");
        break;

      case "spawn": {
        if (isSpawning) {
          ws.send(
            "Cannot execute spawn: a previous launch process is still in progress."
          );
          return;
        }
        isSpawning = true;
        const generatorId = Number(parts[1]);
        const isRoomCreated = JSON.parse(parts[2]);
        const consumeLocalClients = JSON.parse(parts[3]);

        await spawnBrowser(
          ws,
          `${generatorId}-${nextClientId}`,
          isRoomCreated,
          consumeLocalClients
        );
        nextClientId++;

        ws.send("Successfully spawned browser");
        break;
      }

      case "watch": {
        const creatorId = parts[1];
        for (const { id, page } of pages) {
          if (id === creatorId) return;
          watchStream(ws, page, REASON_CONSUME_NEW);
        }
        break;
      }

      case "remove": {
        const clientId = parts[1];
        const entry = browsers.find((b) => b.id === clientId);
        if (!entry) return ws.send(`No browser for client ${clientId}`);

        await entry.browser.close();

        browsers = browsers.filter((b) => b.id !== clientId);
        pages = pages.filter((p) => p.id !== clientId);
        clientStats.delete(clientId);

        console.log(`Removed client: ${clientId}`);
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
        pages.forEach(async ({ id, page }) => {
          try {
            const videos = await page.$$("[id='video-stream']");

            for (const handle of videos) {
              try {
                const uint8 = await handle.evaluate(async (video) => {
                  if (!video) throw new Error("Video element not found");
                  if (!video.captureStream)
                    throw new Error("captureStream not supported");

                  const stream = video.captureStream();
                  const recorder = new MediaRecorder(stream, {
                    mimeType: "video/webm",
                  });

                  const chunks = [];
                  recorder.ondataavailable = (e) =>
                    e.data.size && chunks.push(e.data);

                  recorder.start();

                  // record 10 seconds
                  await new Promise((r) => setTimeout(r, 10_000));

                  recorder.stop();
                  await new Promise((r) => (recorder.onstop = r));

                  // Convert blob → Uint8Array → plain array for transfer
                  const blob = new Blob(chunks, { type: "video/webm" });
                  const arr = new Uint8Array(await blob.arrayBuffer());
                  return Array.from(arr);
                });

                const targetId = await handle.evaluate((video) => {
                  // find nearest sibling .absolute element
                  const sibling = video.parentElement.querySelector(
                    ".absolute.bottom-2.right-3"
                  );
                  if (!sibling) return null;

                  const p = sibling.querySelector("p");
                  return p ? p.textContent.trim() : null;
                });

                console.log(`Record: ${id} ==> ${targetId}`);

                // Convert back to Node Buffer
                const buffer = Buffer.from(uint8);

                // Upload to Cloudinary
                const stream = require("stream");
                const readable = new stream.PassThrough();
                readable.end(buffer);

                const upload = cloudinary.uploader.upload_stream(
                  {
                    resource_type: "video",
                    public_id: `Room_${roomName}_user:${id}_target:${
                      targetId.split(" ")[1]
                    }`,
                  },
                  (error, result) => {
                    if (error) {
                      console.error("Cloudinary upload error:", error);
                      ws.send(`Upload error: ${error.message}`);
                    } else {
                      console.log("Uploaded:", result.secure_url);
                      ws.send(`Uploaded: ${id} ==> ${targetId}`);
                    }
                  }
                );

                readable.pipe(upload);
              } catch (err) {
                console.error("Video record error:", err);
                ws.send(`Record error: ${err.message}`);
              }
            }
          } catch (err) {
            ws.send(`Record error: ${err.message}`);
          }
        });
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
