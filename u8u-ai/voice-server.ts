/**
 * Standalone WebSocket Server for Voice AI
 * Run separately from Next.js: npx ts-node voice-server.ts
 * Handles Twilio Media Streams connection
 */
import dotenv from "dotenv";

dotenv.config();
import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { handleWebSocketConnection } from "./src/lib/voice/websocket-handler";

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- LOGGING REDIRECTION ---
// Use absolute path relative to this file to ensure it's created in the same folder
const logFilePath = path.resolve(__dirname, "voice-server.log");
const logStream = fs.createWriteStream(logFilePath, {
  flags: "a",
});

// Force create/clear the file on startup to verify it exists
try {
  logStream.write(`\n\n=== SERVER STARTUP: ${new Date().toISOString()} ===\n`);
  console.log(`[Startup] Logging to: ${logFilePath}`);
} catch (e: any) {
  process.stderr.write(`FATAL: Could not write to log file: ${e.message}\n`);
}

// Function to format log entries
const formatLog = (args: any[]) => {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return "[Circular]";
        }
      }
      return String(arg);
    })
    .join(" ");
};

// Redirect console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  const message =
    `[${new Date().toISOString()}] ` +
    `[PID:${process.pid}] ` +
    `[INFO] ${formatLog(args)}\n`;
  try {
    logStream.write(message);
  } catch (e) {}
  originalLog.apply(console, args);
};

console.error = (...args: any[]) => {
  const message = `[${new Date().toISOString()}] [ERROR] ${formatLog(args)}\n`;
  try {
    logStream.write(message);
  } catch (e) {}
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  const message = `[${new Date().toISOString()}] [WARN] ${formatLog(args)}\n`;
  try {
    logStream.write(message);
  } catch (e) {}
  originalWarn.apply(console, args);
};

console.log("--- LOGGING INITIALIZED SUCCESSFULLY ---");
// ---------------------------

const PORT = parseInt(process.env.VOICE_WS_PORT || "3001", 10);
const HOST = process.env.VOICE_WS_HOST || "0.0.0.0";

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health" || req.url === "/health/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    );
    return;
  }

  // Metrics endpoint (basic)
  if (req.url === "/metrics") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(
      "# Voice WebSocket Server Metrics\n# Add Prometheus integration here\n",
    );
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Create WebSocket server
const wss = new WebSocketServer({
  server: httpServer,
  path: "/media",
  perMessageDeflate: false, // Disable compression for low latency
});

console.log(
  "═══════════════════════════════════════════════════════════════════",
);
console.log("  Voice AI Streaming WebSocket Server");
console.log(
  "═══════════════════════════════════════════════════════════════════",
);

// Handle WebSocket connections
wss.on("connection", async (ws: WebSocket, req: any) => {
  console.log(`[Connection] New client from ${req.socket.remoteAddress}`);

  try {
    await handleWebSocketConnection(ws, req);
  } catch (error: any) {
    console.error("[Connection Handler] Error:", error);
    ws.close(1011, "Internal Server Error");
  }
});

// Handle server errors
wss.on("error", (error: any) => {
  console.error("[WebSocket Server] Error:", error);
});

// Start server
httpServer.listen(PORT, HOST, () => {
  console.log(`\n✓ WebSocket server listening on ws://${HOST}:${PORT}/media`);
  console.log(`✓ Health check: http://${HOST}:${PORT}/health`);
  console.log(`✓ Environment:`);
  console.log(
    `  - GROQ_API_KEY: ${process.env.GROQ_API_KEY ? "✓ Set" : "✗ Missing"}`,
  );
  console.log(
    `  - DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? "✓ Set" : "✗ Missing"}`,
  );
  console.log(
    `  - AZURE_SPEECH_KEY: ${process.env.AZURE_SPEECH_KEY ? "✓ Set" : "✗ Missing"}`,
  );
  console.log(
    `  - DATABASE_URL: ${process.env.DATABASE_URL ? "✓ Set" : "✗ Missing"}`,
  );
  console.log(
    `\n═══════════════════════════════════════════════════════════════════`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n[Signal] SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("[Shutdown] Server stopped");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n[Signal] SIGINT received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("[Shutdown] Server stopped");
    process.exit(0);
  });
});

// Log uncaught exceptions
process.on("uncaughtException", (error: any) => {
  console.error("[Uncaught Exception]", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: any) => {
  console.error("[Unhandled Rejection]", reason);
});

export default httpServer;
