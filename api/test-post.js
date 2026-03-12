export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: `Method not allowed: ${req.method}` });
  }

  return res.status(200).json({
    ok: true,
    method: req.method,
    body: req.body || null,
  });
}