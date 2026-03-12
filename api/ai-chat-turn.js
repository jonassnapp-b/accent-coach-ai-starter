export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    method: req.method,
    message: "ai-chat-turn reached",
  });
}