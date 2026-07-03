const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use PORT from env (Zeabur sets this), fallback to 3456 for local dev
const PORT = process.env.PORT || 3456;

// Data file path - use ZEABUR_VOLUME_DATA for cloud persistence, local data/ for dev
const DATA_DIR = process.env.ZEABUR_VOLUME_DATA
  ? path.join(process.env.ZEABUR_VOLUME_DATA, "data")
  : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "meetings.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Data helpers ---
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function getMeetingByShareId(shareId) {
  const meetings = readData();
  return meetings.find((m) => m.shareId === shareId) || null;
}

const STAGES = [
  { key: "oa_application", label: "OA申请" },
  { key: "agreement_seal", label: "协议盖章" },
  { key: "medical_info_app", label: "医信申请" },
  { key: "meeting_held", label: "会议举办" },
  { key: "online_materials", label: "线上材料提交" },
  { key: "offline_materials", label: "线下材料提交" },
  { key: "meeting_payment", label: "会议打款" },
  { key: "invoice_retrieval", label: "取回发票" },
  { key: "meeting_approval", label: "会议核销" },
];

function createDefaultStages() {
  const stages = {};
  STAGES.forEach((s) => {
    stages[s.key] = { completed: false, date: null };
  });
  return stages;
}

// --- API Routes ---
app.get("/api/meetings", (req, res) => {
  res.json(readData());
});

app.post("/api/meetings", (req, res) => {
  const { name, date, personInCharge } = req.body;
  if (!name || !date || !personInCharge) {
    return res.status(400).json({ error: "会议名称、举办日期、负责人为必填项" });
  }
  const meetings = readData();
  const meeting = {
    id: uuidv4(),
    shareId: uuidv4().slice(0, 8),
    name,
    date,
    personInCharge,
    status: "active",
    terminatedNote: "",
    stages: createDefaultStages(),
    createdAt: new Date().toISOString(),
  };
  meetings.push(meeting);
  writeData(meetings);
  io.emit("meeting:created", meeting);
  res.status(201).json(meeting);
});

app.put("/api/meetings/:id/stage", (req, res) => {
  const { stageKey, completed } = req.body;
  const meetings = readData();
  const meeting = meetings.find((m) => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: "会议不存在" });
  if (!meeting.stages[stageKey])
    return res.status(400).json({ error: "流程节点不存在" });

  meeting.stages[stageKey].completed = completed;
  meeting.stages[stageKey].date = completed
    ? new Date().toISOString().slice(0, 10)
    : null;

  const allDone = STAGES.every((s) => meeting.stages[s.key].completed);
  if (allDone && meeting.status === "active") meeting.status = "completed";
  else if (!allDone && meeting.status === "completed")
    meeting.status = "active";

  writeData(meetings);
  io.emit("meeting:updated", meeting);
  res.json(meeting);
});

app.put("/api/meetings/:id/terminate", (req, res) => {
  const { note } = req.body;
  const meetings = readData();
  const meeting = meetings.find((m) => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: "会议不存在" });

  meeting.status =
    meeting.status === "terminated" ? "active" : "terminated";
  meeting.terminatedNote =
    meeting.status === "terminated" ? note || "" : "";

  writeData(meetings);
  io.emit("meeting:updated", meeting);
  res.json(meeting);
});

app.delete("/api/meetings/:id", (req, res) => {
  const meetings = readData();
  const idx = meetings.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "会议不存在" });
  const deleted = meetings.splice(idx, 1)[0];
  writeData(meetings);
  io.emit("meeting:deleted", deleted.id);
  res.json({ success: true });
});

app.get("/api/share/:shareId", (req, res) => {
  const meeting = getMeetingByShareId(req.params.shareId);
  if (!meeting)
    return res.status(404).json({ error: "共享链接无效或会议已删除" });
  res.json(meeting);
});

app.post("/api/share/:shareId/sync", (req, res) => {
  const { stageKey, completed } = req.body;
  const meetings = readData();
  const meeting = meetings.find((m) => m.shareId === req.params.shareId);
  if (!meeting) return res.status(404).json({ error: "会议不存在" });

  meeting.stages[stageKey].completed = completed;
  meeting.stages[stageKey].date = completed
    ? new Date().toISOString().slice(0, 10)
    : null;

  const allDone = STAGES.every((s) => meeting.stages[s.key].completed);
  if (allDone && meeting.status === "active") meeting.status = "completed";
  else if (!allDone && meeting.status === "completed")
    meeting.status = "active";

  writeData(meetings);
  io.emit("meeting:updated", meeting);
  res.json(meeting);
});

app.get("/api/server-info", (req, res) => {
  res.json({
    port: PORT,
    tunnelUrl: process.env.PUBLIC_URL || req.headers.host || null,
  });
});

app.get("/api/public-url", (req, res) => {
  res.json({
    tunnelUrl: process.env.PUBLIC_URL || req.headers.host || null,
  });
});

app.put("/api/public-url", (req, res) => {
  // On cloud, the URL is fixed, so just return the current URL
  res.json({
    tunnelUrl: process.env.PUBLIC_URL || req.headers.host || null,
  });
});

// Shared view route
app.get("/shared/:shareId", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.sendFile(path.join(__dirname, "public", "shared.html"));
});

// --- Socket.io ---
io.on("connection", (socket) => {
  console.log("已连接:", socket.id);
});

// --- Start server ---
server.listen(PORT, "0.0.0.0", () => {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   会议进度共享平台 - 云部署版         ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`数据文件: ${DATA_FILE}`);
});
