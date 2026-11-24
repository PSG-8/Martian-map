# Decisions
- **Vanilla JS, no framework/build** — runs anywhere, instant deploys; keep it unless the app grows a lot.
- **Supabase RPC-only access with RLS** — the browser never touches tables directly.
- **3D only on capable desktops** (v25) — phones lagged and banners didn't show; phones get pre-rendered images with a CSS zoom.
- **Videos hosted in the site repo (`media/`)**, served by Vercel; service worker bypasses them so iOS range requests work.
- **Explainer narration: male voice** (user's request), Kokoro open-source TTS because HeyGen speech credit ran out.
- **Character art: Figma AI image generation (gpt-image)**, motion via HeyGen image-to-video (free plan: 3 clips). Cut-out parallax was removed because it looked like doubled characters.
- **Team highlight is subtle** — only a star (user found the blue card "too much").
- **Questions page is framed as asking nurses/experts**, not as answers.
