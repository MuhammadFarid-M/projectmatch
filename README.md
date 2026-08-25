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

## Running it locally

```bash
pip install -r requirements.txt
python seed.py --sqlite     # builds projectmatch.db with 54 demo profiles
DEMO_MODE=1 FLASK_DEBUG=1 python app.py
```

On Windows PowerShell:

```powershell
$env:DEMO_MODE=1; $env:FLASK_DEBUG=1; python app.py
```

With `DEMO_MODE` on you can click **Demo login** to enter as the post owner, or
visit `/demo-login?id=2` to enter as a candidate. Seeded users 1–9 are
hand-written to demonstrate specific scoring behaviour; 10–54 are generated.

## Deploying

Demo login signs anyone in as any account without a password, so the route is
**registered only when `DEMO_MODE` is set**. On a live host, leave it unset and
the route does not exist — it returns 404 rather than being merely hidden.

Two environment variables matter in production:

| Variable | Set it to | Why |
|---|---|---|
| `SECRET_KEY` | a long random string | signs session cookies. Unset, the app generates a random one at boot, so sessions drop on every restart |
| `DEMO_MODE` | leave unset | keeps passwordless login out of the build |

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

### Render (free tier)

1. Push to GitHub, then **New → Web Service** and pick the repo.
2. Build command: `pip install -r requirements.txt`
3. Start command: `python app.py`
4. Under **Environment**, add `SECRET_KEY` with a long random value. Do not add
   `DEMO_MODE` or `FLASK_DEBUG`.

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
| `app.py` | Flask server: form routes, JSON API, session auth. |
| `try_match.py` | Terminal harness for the scorer. |
| `static/` | Frontend — plain HTML, one stylesheet, vanilla JS. |

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
