
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function seasonId(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();               // 0=Sun..6=Sat
  const toSun = (7 - day) % 7;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + toSun);
  const year = end.getFullYear();
  const yStart = new Date(year, 0, 1);
  const days = Math.floor((end - yStart) / (24 * 3600 * 1000));
  const week = Math.floor(days / 7) + 1;
  return `${year}-W${week}`;
}
const keyFor = (sid) => `lb:${sid || seasonId()}`;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  const { result } = await r.json();
  return result ?? null;
}
async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value, nx: false }),
  });
  return r.ok;
}

export default async function handler(req) {
  try {
    const url    = new URL(req.url);
    const method = req.method;
    const action = url.searchParams.get("action");
    const sid    = url.searchParams.get("season") || seasonId();
    const key    = keyFor(sid);

    // GET /api/leaderboard
    if (method === "GET" && (!action || action === "get")) {
      const state   = (await kvGet(key)) || { seasonId: sid, players: {} };
      const players = Object.values(state.players || {}).sort((a,b)=>(b.xp||0)-(a.xp||0));
      return new Response(JSON.stringify({ seasonId: sid, players }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // POST /api/leaderboard?action=award   body: { userId, name?, delta }
    if (method === "POST" && action === "award") {
      const { userId, name, delta } = await req.json();
      if (!userId || typeof delta !== "number") return new Response("Bad request", { status: 400 });

      const state = (await kvGet(key)) || { seasonId: sid, players: {} };
      const cur   = state.players[userId] || { id: userId, name: name || "You", xp: 0 };
      if (name && name.trim()) cur.name = name.trim();
      cur.xp = Math.max(0, Math.round((cur.xp || 0) + delta));
      state.players[userId] = cur;
      await kvSet(key, state);

      return new Response(JSON.stringify(cur), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // POST /api/leaderboard?action=setName   body: { userId, name }
    if (method === "POST" && action === "setName") {
      const { userId, name } = await req.json();
      if (!userId || !name) return new Response("Bad request", { status: 400 });

      const state = (await kvGet(key)) || { seasonId: sid, players: {} };
      const cur   = state.players[userId] || { id: userId, name: "You", xp: 0 };
      cur.name = String(name);
      state.players[userId] = cur;
      await kvSet(key, state);

      return new Response(JSON.stringify(cur), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
