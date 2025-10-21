// dev-server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// 🔎 request log – se hvad der faktisk rammer serveren
app.use((req, _res, next) => {
  console.log(req.method, req.path);
  next();
});

// ping til hurtig test
app.get("/api/ping", (_req, res) => res.json({ ok: true, now: Date.now() }));

// dine handlers
const analyzeSpeech = (await import("./api/analyze-speech.js")).default;
const leaderboard = (await import("./api/leaderboard.js")).default;

// 🚩 bind præcist på POST /api/analyze-speech
app.use("/api", analyzeSpeech);

// leaderboard (som før)
app.get("/api/leaderboard", leaderboard);
app.post("/api/leaderboard", leaderboard);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(3000, "0.0.0.0", () => {
  console.log("API ready on http://localhost:3000");
  console.log("  GET  /api/ping");
  console.log("  POST /api/analyze-speech");
  console.log("  GET/POST /api/leaderboard");
});
