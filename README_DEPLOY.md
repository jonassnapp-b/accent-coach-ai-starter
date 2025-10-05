# Accent Coach AI — klik-guide (uden kode)

## Det her har du
- `backend/` (Node/Express). Giver en `/api/score` endpoint (mock score nu).
- `frontend/` (Vite React). Optager lyd og kalder backend.

## Hurtig deploy (gratis niveauer findes)
### 1) Opret GitHub-repo
- Gå til github.com → New → Repository name: `accent-coach-ai-starter`
- Upload mapperne `backend/` og `frontend/` (eller træk hele zip’en ud og `git push` hvis du kan).

### 2) Deploy backend på Render (nemt)
- Gå til render.com → Sign up → New + Web Service
- Vælg dit GitHub-repo → `backend/` som Root directory
- Runtime: Node 18+
- Build command: *(tom)*
- Start command: `node server.js`
- Environment:
  - `PORT` = 3001 (Render sætter selv)
  - `FRONTEND_ORIGIN` = **senere**, når du har frontend-URL (kan midlertidigt være `*`)
- Deploy → Vent til du ser en URL som `https://<dit-backend>.onrender.com`

### 3) Deploy frontend på Vercel
- Gå til vercel.com → New Project → Import GitHub repo
- Project Settings:
  - Root directory: `frontend/`
  - Framework preset: `Vite`
  - Build command: `npm run build`
  - Output dir: `dist`
- Environment Variables (i Vercel → Settings → Environment Variables):
  - `VITE_API_BASE` = din backend-URL fra Render, fx `https://<dit-backend>.onrender.com`
- Deploy → du får en frontend-URL som `https://<dit-frontend>.vercel.app`

### 4) (Valgfrit) Strammere sikkerhed
- Gå tilbage til Render → Miljøvariabler → sæt `FRONTEND_ORIGIN` = din Vercel URL `https://<dit-frontend>.vercel.app`
- Re-deploy backend.

## Test
- Åbn din frontend-URL → Optag → Analyser → du får en score tilbage.

## Næste skridt (senere)
- Skift fra mock-score til Azure Speech Pronunciation Assessment.
- Tilføj login + betaling (Stripe) hvis du vil tage abonnementsindkomst.

