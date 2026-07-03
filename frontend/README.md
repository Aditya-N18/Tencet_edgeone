# Senior Guardian Frontend

Elderly-friendly, calming dark-themed companion app for the in-room tablet.

## Stack

- **Vite** — fast dev server and builds
- **React 18** (JavaScript, no TypeScript)
- **React Router 6** — Home, Monitor, Voice Help, Settings
- **Tailwind CSS 3.4** — utility styling, large `elder-*` type scale
- **shadcn/ui** — Button, Card, Badge (Radix + CVA)
- **Aceternity-style** — BackgroundBeams, GlowingCard, PulseOrb (Framer Motion)

## Design choices

- Dark navy background — easy on eyes, especially at night
- Teal/sage accents — calm, not alarm-red unless emergency
- Minimum 1.25rem base font, large tap targets (56px+ buttons)
- Bottom nav with icons + labels — familiar tablet pattern
- Voice page requests mic permission and will connect to Vapi Web SDK next

## Run

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Routes

| Path | Purpose |
|------|---------|
| `/` | Welcome + quick actions |
| `/monitor` | Camera / YOLO status (Butterbase realtime later) |
| `/voice` | Microphone voice help session |
| `/settings` | Profile, contacts, alert preferences |

## Next integration steps

1. Butterbase SDK — auth + realtime on `incidents`
2. Vapi Web SDK on `/voice` — replace demo question flow
3. Auto-start voice when realtime incident arrives
