# ProjectMatch

A team-formation platform. You post the roles your team is still missing, and
everyone on the platform is ranked by how much of that gap they close.

Built for the ProjectMatch problem statement: *"people forming teams rely on
existing social connections, which makes it difficult to discover people with
complementary skills."*

---

## The core idea

Most matching systems rank on **similarity** — they find people like you. That
is exactly wrong for team formation. A developer needing a designer does not
want another developer.

ProjectMatch ranks on **complementarity**: a candidate is scored against the
skills the team is *still missing*, not against the person searching. Someone
excellent whose skills the team already has scores low, and that is correct.

Similarity is used in exactly one place — shared interest domains — so you are
matched with people who are different in skills but aligned on what they want
to build.

## How the ranking works

Two stages.

**Hard filters** remove people rather than scoring them down: the post owner,
anyone already on the team, anyone who has switched off "open to joining",
anyone whose availability does not cover the event, and — for in-person events
— anyone in the wrong city who is not willing to travel. The availability rule
scales with event length: short events require full coverage, long projects only
require being free at the start plus a meaningful commitment.

**Weighted score**, each component normalised 0–1:

| Component | Weight | What it reads |
|---|---|---|
| Gap coverage | 0.40 | must-have skills ×2, nice-to-have ×1, minus skills the team already has |
| Project relevance | 0.20 | do their past projects resemble *this* work? |
| Interest overlap | 0.15 | Jaccard similarity on domain tags |
| Experience fit | 0.15 | their level against the role's minimum |
| Availability | 0.10 | hours/week they have against hours the project needs |

Covering zero must-haves multiplies the total by 0.55, so nobody climbs into
mid-table on domain overlap alone.

**Project relevance** scores each past project on how much of the role's skill
list it used and whether it sat in a relevant domain, then scales that by how
substantial it looks — shipped vs prototype, how long it ran, whether there is a
link to open. Depth *modulates* relevance rather than adding to it, so a deep
but irrelevant project never outranks a relevant one. The best-matching project
carries 70% of the component and the second-best 30%: one genuinely relevant
project beats five unrelated ones.

Every score comes with a generated reason string and a component breakdown, so
a ranking can be audited rather than taken on trust.

## Matching runs in both directions

Same engine, arguments flipped.

- **Post → people.** Ranked candidates per open role, with the people dropped by
  hard filters listed alongside and the reason each was dropped.
- **Person → posts.** A logged-in user's home page is a ranked feed of open
  roles rather than an empty search box.

Teams can invite candidates directly; candidates can apply. Both create the same
record, distinguished by a `direction` column — they differ only in who
initiated and therefore who decides.

## How it is put together

A Flask JSON API and a React single-page app, with nothing shared between them
but the JSON.

Everything the server does lives under `/api/` and speaks JSON in both
directions. Anything else falls through to the built frontend, so a hard
refresh on `/posts/3` loads the app rather than 404ing. Sessions are ordinary
Flask cookies: the frontend is served from the same origin in production and
proxied through Vite in development, so the cookie rides along by itself and
there is no CORS layer and no token to keep in sync.

The scoring engine is deliberately unaware of all of it. `match.py` imports
nothing from Flask and touches no database, which is what lets it be exercised
straight from a terminal.

## Running it locally

```bash
pip install -r requirements.txt
npm --prefix frontend install
npm --prefix frontend run build          # writes frontend/dist
python seed.py --sqlite                  # builds projectmatch.db with 54 demo profiles
DEMO_MODE=1 FLASK_DEBUG=1 python app.py  # http://127.0.0.1:5000
```

On Windows PowerShell:

```powershell
$env:DEMO_MODE=1; $env:FLASK_DEBUG=1; python app.py
```

While working on the frontend, run Vite instead of rebuilding on every change:

```bash
python app.py                     # :5000, the API
npm --prefix frontend run dev     # :5173, hot reload, proxies /api to :5000
```

With `DEMO_MODE` on, visiting `/api/demo-login` signs you in as the post owner
and `/api/demo-login?id=2` as a candidate — no password, straight into either
side of the product. Seeded users 1–9 are hand-written to demonstrate specific
scoring behaviour; 10–54 are generated.

## Deploying

Demo login signs anyone in as any account without a password, so the route is
**registered only when `DEMO_MODE` is set**. On a live host, leave it unset and
the route does not exist — it returns 404 rather than being merely hidden.

Two environment variables matter in production:

| Variable | Set it to | Why |
|---|---|---|
| `SECRET_KEY` | a long random string | signs session cookies. Unset, the app generates a random one at boot, so sessions drop on every restart |
| `DEMO_MODE` | leave unset | keeps passwordless login out of the build |
| `DATABASE_URL` | your Render Postgres URL | without it, data is lost on every restart |

`FLASK_DEBUG` must also stay unset — Flask's debugger exposes an interactive
Python console on any error.

Generate a key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

The app reads `PORT` if the host sets one, and binds `0.0.0.0` when not in
debug, which is what most platform-as-a-service hosts expect.

The database is gitignored, so the app seeds itself on first boot — schema plus
the 54 demo profiles. It checks for existing users first, so restarts and
redeploys never overwrite real signups.

### Storage: SQLite locally, Postgres in production

Render's free web services have an ephemeral filesystem — the container is
rebuilt on every redeploy, restart, and spin-down after 15 minutes idle. A
SQLite file does not survive that, so user accounts vanish.

`db.py` handles both backends behind one interface. Set `DATABASE_URL` and the
app uses Postgres; leave it unset and it falls back to a local SQLite file, so
nothing needs installing for local development. Application code is written
once — the layer translates placeholders, auto-generated ids, row types, and
the schema dialect.

To add persistence on Render: **New → Postgres**, free instance, then copy its
Internal Database URL into your web service's environment as `DATABASE_URL`.
The app builds its schema and seeds itself on the next deploy. Note that free
Render Postgres databases expire 30 days after creation.

### Render (free tier)

1. Push to GitHub, then **New → Web Service** and pick the repo.
2. Build command: `pip install -r requirements.txt`
3. Start command: `python app.py`
4. Under **Environment**, add `SECRET_KEY` with a long random value. Do not add
   `DEMO_MODE` or `FLASK_DEBUG`.

**`frontend/dist` is committed to the repo, on purpose.** The build command
above installs Python and nothing else, so there is no Node step on the host to
produce it. The cost is that a UI change is not deployed until the build is
rebuilt and committed with it:

```bash
npm --prefix frontend run build && git add frontend/dist
```

If you would rather Render build the frontend itself, change the build command
to `npm --prefix frontend ci && npm --prefix frontend run build && pip install
-r requirements.txt` and add `frontend/dist` to `.gitignore`. That removes the
stale-build failure mode and adds a dependency on Node being present in the
build image.

Render's free tier has an ephemeral filesystem and sleeps after inactivity, so
the database resets on restart and reseeds itself. Fine for a demo; attach a
persistent disk and point `PROJECTMATCH_DB` at it if data needs to last.

Test the engine without the UI:

```bash
python try_match.py
```

## Files

| File | What it does |
|---|---|
| `match.py` | The scoring engine. Pure functions, no database, no framework. |
| `vocab.py` | Controlled vocabulary — roles, skills, event types, domains. |
| `seed.py` | Generates demo data and the SQLite schema. |
| `app.py` | Flask server: the JSON API, session auth, and the SPA fallback. |
| `db.py` | One interface over SQLite and Postgres. |
| `try_match.py` | Terminal harness for the scorer. |
| `frontend/` | React app (Vite). `src/pages` are the routes, `src/components` the shared pieces. |
| `frontend/dist/` | The build Flask serves. Committed — see Deploying. |

Skills are picked from a fixed vocabulary rather than typed freely, which turns
matching into set operations and avoids an entire class of string-normalisation
problems ("React" vs "ReactJS" vs "react.js").

## Known limitations

Being explicit about these rather than pretending otherwise:

- **Notifications are in-app only.** No email, no push. A user learns an outcome
  when they next open the site. The data model supports adding email — every
  decision writes a timestamped row with a `seen` flag.
- **Project depth is self-reported.** Someone could mark everything "shipped".
  The repo link is the checkable part.
- **No verification of GitHub or LinkedIn links.** They are stored and displayed,
  not fetched or parsed.
- **Seed data is fictional.** The 54 generated profiles have no password, so
  nobody can log in as them — but they still appear in rankings. On a genuinely
  public deployment you would clear them; for a demo they are what stops the
  platform looking empty.
- **SQLite with the default file path** is per-instance and will reset on hosts
  with an ephemeral filesystem. Point `PROJECTMATCH_DB` at a persistent volume,
  or move to Postgres, if data needs to survive.
- **The committed frontend build can go stale.** Nothing checks that
  `frontend/dist` matches `frontend/src`; if a UI change is pushed without a
  rebuild, the deploy silently serves the previous one.
- **No automated tests** beyond `try_match.py`, which exercises the scorer and
  not the API or the UI.
