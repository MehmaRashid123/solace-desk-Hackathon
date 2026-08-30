import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { corsOptions } from "./lib/cors.js";
import { setIo } from "./lib/io.js";
import { attachSockets } from "./sockets/index.js";

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: corsOptions,
});

setIo(io);
attachSockets();

httpServer.listen(config.port, () => {
  console.log(`Lumen API on http://localhost:${config.port}`);
});
