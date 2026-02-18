const express = require("express");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const Database = require("better-sqlite3");
const midi = require("midi");

// ---------------- MIDI: output setup ----------------
const output = new midi.Output();
const input = new midi.Input();
const portName = "MixxxWebRemote";

if (os.platform() === 'win32') {
  // WINDOWS: Look for an existing loopMIDI port
  let found = false;
  for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes(portName)) {
      output.openPort(i);
      found = true;
      break;
    }
  }
  if (!found) {
    console.error(`❌ ERROR: Could not find loopMIDI port named "${portName}". Please create it in loopMIDI first!`);
  } else {
    console.log(`✅ Connected to loopMIDI: ${portName}`);
  }
} else {
  // LINUX/MAC: Create a virtual port natively
  output.openVirtualPort(portName);
  input.openVirtualPort(portName);
  console.log(`✅ Virtual MIDI port created: ${portName}`);
}

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const NOTE_FADE_NOW = 60;
const NOTE_SKIP_NEXT = 61;
const NOTE_FORWARD = 62;
const NOTE_BACKWARD = 63;
const NOTE_FORWARD_2 = 64;
const NOTE_BACKWARD_2 = 65;

function tap(note) {
  output.sendMessage([NOTE_ON, note, 127]);
  setTimeout(() => output.sendMessage([NOTE_OFF, note, 0]), 20);
}

// ---------------- AutoDJ next track (SQLite) ----------------
let DB_PATH;
if (os.platform() === 'win32') {
  DB_PATH = path.join(os.homedir(), "AppData", "Local", "Mixxx", "mixxxdb.sqlite");
} else {
  DB_PATH = path.join(os.homedir(), ".mixxx", "mixxxdb.sqlite");
}

// !!! IMPORTANT: Initialize the DB variable here !!!
const db = new Database(DB_PATH, { readonly: true });
console.log(`🗄️  Connected to Mixxx database at: ${DB_PATH}`);

function getAutoDjPlaylistId() {
  const row = db.prepare(`
    SELECT id FROM Playlists
    WHERE lower(name) LIKE '%auto dj%'
       OR lower(name) LIKE '%autodj%'
    ORDER BY id ASC
    LIMIT 1
  `).get();
  return row?.id ?? null;
}

function getNextAutoDj() {
  const pid = getAutoDjPlaylistId();
  if (!pid) return { ok: false, reason: "no_autodj_playlist" };

  const row = db.prepare(`
    SELECT l.artist, l.title
    FROM PlaylistTracks pt
    JOIN library l ON l.id = pt.track_id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
    LIMIT 1
  `).get(pid);

  if (!row) return { ok: false, reason: "queue_empty" };
  return { ok: true, artist: row.artist, title: row.title };
}

function getAutoDjQueue(limit = 20) {
  const pid = getAutoDjPlaylistId();
  if (!pid) return { ok: false, reason: "no_autodj_playlist", items: [] };

  const rows = db.prepare(`
    SELECT
      pt.position AS position,
      l.artist   AS artist,
      l.title    AS title
    FROM PlaylistTracks pt
    JOIN library l ON l.id = pt.track_id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
    LIMIT ?
  `).all(pid, limit);

  return { ok: true, items: rows };
}

// ---------------- Web server ----------------
const app = express();

app.get("/fade_now", (_req, res) => {
  tap(NOTE_FADE_NOW);
  res.json({ ok: true });
});

app.get("/skip_next", (_req, res) => {
  tap(NOTE_SKIP_NEXT);
  res.json({ ok: true });
});

app.get("/forward", (_req, res) => {
  tap(NOTE_FORWARD);
  res.json({ ok: true });
});

app.get("/backward", (_req, res) => {
  tap(NOTE_BACKWARD);
  res.json({ ok: true });
});

app.get("/forward2", (_req, res) => {
  tap(NOTE_FORWARD_2);
  res.json({ ok: true });
});

app.get("/backward2", (_req, res) => {
  tap(NOTE_BACKWARD_2);
  res.json({ ok: true });
});

app.get("/queue", (_req, res) => {
  res.json(getAutoDjQueue(20));
});

app.get("/status", async (_req, res) => {
  res.json({
    ok: true,
    nextAutoDj: getNextAutoDj(),
    queue: getAutoDjQueue(20)
  });
});

// CC on channel 1
const CC = 0xB0;
const CC_MASTER_GAIN = 0x07;

function sendCC(cc, value) {
  const v = Math.max(0, Math.min(127, value|0));
  output.sendMessage([CC, cc, v]);
}

app.get("/master/:v", (req, res) => {
  sendCC(CC_MASTER_GAIN, parseInt(req.params.v, 10));
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  // ... (HTML content remains the same as your snippet)
  res.type("html").send(`...`); 
});

app.listen(8787, () =>
  console.log("🚀 Web remote running: http://localhost:8787/")
);
