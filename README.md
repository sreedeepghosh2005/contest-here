# Contest Here

Timed coding contests for events. Admins add questions and test cases. Participants press Start, solve, and race on the leaderboard. Languages: C, C++, Java, Python 3.

**Demo:** https://sreedeepghosh2005.github.io/contest-here/

> **Not open source. All rights reserved.** You can read the code and try it on your own computer.
> To run it for a contest or any event with participants, you need written permission first.
> [Request permission](https://github.com/sreedeepghosh2005/contest-here/issues/new?template=permission-request.yml). See [LICENSE](LICENSE).

## Run it

Needs Node 22.13+ and Docker.

```bash
npm install
npm run build-runner                 # builds the contest-here-runner image (gcc, g++, JDK 17, Python 3.11)
npm run build-web                    # builds the React landing page into public-landing/
ADMIN_PASSWORD=choose-one npm start  # http://localhost:3000
```

## Landing page (`web/`)

`/` is a React + TypeScript + Tailwind page in shadcn layout (`web/components.json`, alias `@/` → `web/src/`).
shadcn components live in `web/src/components/ui/`. The shadcn CLI adds new ones there: `cd web && npx shadcn@latest add <name>`.

- `web/src/App.tsx`: hero with the name and buttons, then the join form.
- `web/src/components/ui/particle-hero.tsx`: `ParticleHero`. A 3D particle sculpture drawn on a `<canvas>`.
  It morphs between 5 forms, tilts with the pointer and pulses on click. It needs no network.
  With "reduce motion" turned on in the OS, it draws one still frame.

`npm run build-web` writes to `public-landing/`. `server.js` serves that folder before `public/`.
Run it again after any change in `web/`.

`npm --prefix web run build:pages` builds the demo site (`web/src/Showcase.tsx` + `web/pages-public/shots/`) into `web/dist-pages/`.
`sh web/deploy-demo.sh` builds it and pushes it to the `gh-pages` branch. GitHub Pages serves that branch.
Run it after you change the demo site.

## Theme

One theme for every page: mint background with a dot grid, ink text `#26332c`, orange accent `#e08a36`, pill buttons.
Fonts: Unbounded (headings), Inter (text), JetBrains Mono (code). They load from Google Fonts. Without internet the pages fall back to system fonts.
The colours are in two places and must match: `public/style.css` (`:root`) and `web/src/index.css`.

| Env var | Default | What it does |
|---|---|---|
| `ADMIN_PASSWORD` | (required) | Password for `/admin.html` |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Folder for `arena.db` (SQLite) |
| `JUDGE_CONCURRENCY` | `4` | How many sandbox containers run at once |
| `RUNNER_IMAGE` | `contest-here-runner` | Docker image used to judge code |

## How an event runs

1. Admin opens `/admin.html` and creates an event. Each event has a join code.
2. Admin adds questions. Each question has a statement, a time limit per test, and test cases.
   Tick **Sample** on a test case to show it to participants. Other test cases stay hidden.
3. Admin saves the question, then uses **Check with a reference solution** to confirm the expected outputs.
4. Admin presses **Open event** and shares the link `/?code=<CODE>`.
5. A participant joins with the code, a name and a PIN. The same name and PIN log in again from another device.
6. The participant opens a question. The statement is hidden until they press **Start**. Start writes `attempts.started_at`.
7. **Run** runs the code on custom input. It is not graded or saved.
8. **Submit** runs the code on every test case. If all pass, the server writes `attempts.solved_at` with the submit time.
9. Admin presses **Close event** at the end. Nobody can join, start or submit after that.

## Leaderboard

`/leaderboard.html?code=<CODE>` is public. It refreshes every 5 seconds. Put it on the projector.

- Solve time for one question = `solved_at - started_at`.
- Rank: more questions solved first. Then less total solve time. Then earlier last solve.
- Wrong submissions are shown in red. They do not add a penalty.

## Judging

`judge.js` starts one Docker container per Run or Submit. It sends the code and the test inputs as JSON on stdin.
Expected outputs never go into the container. `runner/runner.py` compiles once and runs each test as user `nobody`.

Container limits: no network, 512 MB memory, 1 CPU, 256 processes, read-only root, 32 MB max file size.
Output is compared line by line. Trailing spaces and trailing blank lines are ignored.

Java code must use `public class Main`.

## Capacity

Each judge run takes about 0.5-2 s (Java is the slowest). With `JUDGE_CONCURRENCY=4`, expect roughly 2-6 submits per second.
Raise it on a machine with more cores. Runs over the limit wait in a queue.
Admin logins are kept in memory. Restarting the server logs the admin out. Participant data stays in SQLite.

## Deploy

The judge starts Docker containers, so the server needs Docker. Use a Linux VPS (Ubuntu 24.04, 2+ vCPU, 4 GB RAM).
Hosts without Docker access (Vercel, Netlify, Render, Railway) cannot run the judge.

```bash
# on the server, as root
apt update && apt install -y docker.io git caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
useradd -r -m -G docker contest
git clone https://github.com/<owner>/contest-here.git /opt/contest-here
cd /opt/contest-here && npm ci && npm run build-runner && npm run build-web
mkdir -p /var/lib/contest-here && chown -R contest /opt/contest-here /var/lib/contest-here
echo 'ADMIN_PASSWORD=<choose-a-long-one>' > /etc/contest-here.env && chmod 600 /etc/contest-here.env
cp deploy/contest-here.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now contest-here
cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the domain first
systemctl reload caddy
```

Update: `cd /opt/contest-here && git pull && npm ci && npm run build-web && systemctl restart contest-here`.
Back up `/var/lib/contest-here/arena.db` after each event.
