const express = require("express");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const Database = require("better-sqlite3");
const midi = require("midi");

// ---------------- MIDI: virtual output ----------------
const output = new midi.Output();
const input = new midi.Input();
output.openVirtualPort("MixxxWebRemote");
input.openVirtualPort("MixxxWebRemote");
console.log("Virtual MIDI port created: MixxxWebRemote");

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const NOTE_FADE_NOW = 60;  // must match .midi.xml
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
const DB_PATH = path.join(os.homedir(), ".mixxx", "mixxxdb.sqlite");
const db = new Database(DB_PATH, { readonly: true });

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

// value: 0..127
function sendCC(cc, value) {
  const v = Math.max(0, Math.min(127, value|0));
  output.sendMessage([CC, cc, v]);
}

app.get("/master/:v", (req, res) => {
  sendCC(CC_MASTER_GAIN, parseInt(req.params.v, 10));
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: sans-serif; padding: 12px; background-color: #111133; color: #ddddee; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
    button { font-size: 26px; padding: 14px 16px; background-color: #000022; color: #ddddee; border: 1px solid #eeeeee; }
    button:hover { background-color: #222244; cursor: pointer; }
    button:active { background-color: #000022; }
    .card { margin-top: 14px; padding: 12px; border: 1px solid #eeeeee; border-radius: 10px; }
    input[type="range"] { width: 100%; }
    .value { font-size: 18px; min-width: 80px; text-align: right; }
    pre { margin-top: 14px; font-size: 14px; }
  </style>
</head>
<body>

  <div class="row">
    <button onclick="fetch('/fade_now')">Transition now</button>
    <button onclick="fetch('/skip_next')">Skip next</button>
  </div>
  <div class="row">
    <span>Deck 1</span>
    <button onclick="fetch('/backward')">Backward</button>
    <button onclick="fetch('/forward')">Forward</button>
  </div>
  <div class="row">
    <span>Deck 2</span>
    <button onclick="fetch('/backward2')">Backward</button>
    <button onclick="fetch('/forward2')">Forward</button>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between;">
      <div style="font-size:18px;"><b>Master volume</b></div>
      <div class="value"><span id="mvText">80</span>/127</div>
    </div>

    <input id="mv" type="range" min="0" max="127" value="80" step="1"/>
  </div>

  <pre id="out"></pre>

<div class="card">
  <div style="font-size:18px;"><b>AutoDJ queue (next 20)</b></div>
  <table id="qtable" style="width:100%; border-collapse:collapse; margin-top:10px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ccc; padding:6px;">#</th>
        <th style="text-align:left; border-bottom:1px solid #ccc; padding:6px;">Artist</th>
        <th style="text-align:left; border-bottom:1px solid #ccc; padding:6px;">Title</th>
      </tr>
    </thead>
    <tbody id="qbody"></tbody>
  </table>
</div>

  <script>
    const mv = document.getElementById('mv');
    const mvText = document.getElementById('mvText');
    let lastSent = -1;
    let sendTimer = null;

    function sendMaster(v) {
      // small debounce so we don't spam requests while dragging
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = setTimeout(() => fetch('/master/' + v).catch(()=>{}), 25);
    }

    function onMvInput() {
      const v = parseInt(mv.value, 10);
      mvText.textContent = v;
      if (v !== lastSent) {
        lastSent = v;
        sendMaster(v);
      }
    }

  function renderQueue(queue) {
    const body = document.getElementById('qbody');
    body.innerHTML = "";

    if (!queue || !queue.ok) {
      const tr = document.createElement("tr");
      const reason = queue?.reason || "unknown";
      tr.innerHTML = '<td colspan="3" style="padding:8px; color:#a00;">Queue unavailable: ' + reason + '</td>r';
      body.appendChild(tr);
      return;
    }

    const items = queue.items || [];
    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="3" style="padding:8px; color:#555;">(empty)</td>';
      body.appendChild(tr);
      return;
    }

    for (const row of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td style="padding:6px; border-bottom:1px solid #eee;">' + row.position + '</td>' +
        '<td style="padding:6px; border-bottom:1px solid #eee;">' + (row.artist || "") + '</td>' +
        '<td style="padding:6px; border-bottom:1px solid #eee;">' + row.title + '</td>';
      body.appendChild(tr);
    }
  }

    mv.addEventListener('input', onMvInput);
    onMvInput(); // apply initial value on page load

    async function refresh() {
      const r = await fetch('/status');
      const data = await r.json();
      renderQueue(data.queue);
    }
    setInterval(refresh, 1000);
    refresh();
  </script>

</body>
</html>
  `);
});

app.listen(8787, () =>
  console.log("Web remote running: http://localhost:8787/")
);

