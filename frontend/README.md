# RepLoad frontend

The mobile-first RepLoad frontend is built with Next.js and deployed to
[Vercel](https://repload.vercel.app/). It uses the authenticated NestJS API
deployed to [Render](https://repload.onrender.com/).

## Local development

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

The local API proxy defaults to `http://localhost:4000`. Start the backend in
a separate terminal. To use another backend, set `BACKEND_URL` in `.env.local`.
All browser requests use the same-origin `/api/backend` path; Next.js rewrites
these requests to the backend so the HttpOnly session cookie works in mobile
and desktop browsers without relying on third-party cookies.

## Vercel deployment

Set the project root directory to `frontend` and configure this environment
variable for Production (and Preview if desired):

```text
BACKEND_URL=https://repload.onrender.com
```

Deployments use `npm run build`. The frontend API proxy keeps requests on the
Vercel origin and forwards them to Render.

## Mobile experience

The UI supports narrow phone viewports, safe-area insets, touch-friendly
controls, a fixed five-item mobile navigation bar, and reduced-motion
preferences. Its central quick-action menu creates templates or starts a
template assigned to the current weekday; when no workout is scheduled, it
offers no blank-workout start action.
