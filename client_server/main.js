const WebSocket = require("ws");
const puppeteer = require("puppeteer");

const client_num = 5;
const roomName = "A";

const wss = new WebSocket.Server({ port: 3677 });
console.log("WebSocket server is running on ws://localhost:3677");

const browsers = [];

wss.on("connection", (ws) => {
  console.log("Orchester connected");

  ws.on("message", async (message) => {
    if (message.toString() === "ping") {
      ws.send("pong");
    } else if (message.toString() === "spawn") {
      for (let i = 0; i < client_num; i++) {
        const browser = await puppeteer.launch({
          headless: false,
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        });

        browsers.push(browser);

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto("http://localhost:3000");

        if (i > 0) {
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
        }

        const screenShareBtn = await page.waitForSelector("#toggleScreenShare");
        const box = await screenShareBtn.boundingBox();

        await page.mouse.click(box.x + box.width / 2, box.y + 3);
      }
    }
  });

  ws.on("close", async () => {
    console.log("Orchester disconnected");
    for (const browser of browsers) await browser.close();
  });
});
