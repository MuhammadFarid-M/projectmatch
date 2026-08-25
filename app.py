"""
ProjectMatch -- Flask backend.

Design: hybrid. Plain HTML forms POST to Flask and redirect (no JS needed
for signup, login, profile, post creation, apply, accept). Fetch + JSON is
used only where the page is genuinely dynamic -- the ranked lists and their
filters, which update without a reload.

Run:
    python seed.py --sqlite     (once, to build the database)
    python app.py               (then open http://127.0.0.1:5000)
"""

import json
import os
import secrets
from functools import wraps

import db

from flask import (Flask, g, jsonify, redirect, request,
                   send_from_directory, session)
from werkzeug.security import check_password_hash, generate_password_hash

from match import rank_candidates, rank_posts_for_user, score_candidate
from vocab import ROLES, SKILLS, EVENT_TYPES, DOMAINS, LEVELS

# Demo login lets anyone sign in as any account without a password. That is
# useful on a laptop and unacceptable on a public URL, so it is OFF unless
# you explicitly ask for it:  set DEMO_MODE=1 in your shell.
DEMO_MODE = os.environ.get("DEMO_MODE", "").lower() in ("1", "true", "yes")

app = Flask(__name__, static_folder="static", static_url_path="")

# In production set SECRET_KEY as an environment variable. Falling back to a
# random value means sessions simply don't survive a restart, which is a much
# better failure than shipping a key that is public in the repo.
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

JSON_FIELDS = {"skills", "interests", "domains", "must_have",
               "nice_to_have", "past_projects"}


def ensure_seeded():
    """
    Build the database on first boot if it isn't there yet.

    Checks whether users already exist first, so a restart never wipes real
    signups -- the schema's DROP TABLE statements are only ever reached on a
    genuinely empty database.
    """
    import seed

    c = db.connect()
    try:
        if db.table_exists(c, "users"):
            cur = c.cursor()
            cur.execute("SELECT COUNT(*) AS n FROM users")
            row = db.to_dict(cur.fetchone())
            cur.close()
            if row and list(row.values())[0]:
                c.close()
                return

        data = seed.build()
        db.build_schema(c, seed.SCHEMA)
        seed_rows(c, data)
        print(f"seeded {len(data['users'])} users, {len(data['posts'])} posts")
    finally:
        c.close()


def seed_rows(c, data):
    """Load the generated profiles and posts, backend-agnostically."""
    cur = c.cursor()
    ins = lambda s, a: cur.execute(db.sql(s), a)

    for u in data["users"]:
        ins("""INSERT INTO users (id,name,email,bio,role,skills,interests,
               experience_level,hours_per_week,projects_done,past_projects,
               location,remote_ok,willing_to_travel,open_to_join,
               available_from,available_to,github,linkedin)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (u["id"], u["name"], u["email"], u["bio"], u["role"],
             json.dumps(u["skills"]), json.dumps(u["interests"]),
             u["experience_level"], u["hours_per_week"], u["projects_done"],
             json.dumps(u.get("past_projects", [])),
             u["location"], int(u["remote_ok"]), int(u["willing_to_travel"]),
             int(u["open_to_join"]), u["available_from"], u["available_to"],
             u["github"], u["linkedin"]))

    for p in data["posts"]:
        ins("""INSERT INTO posts (id,owner_id,title,description,event_type,
               domains,starts_on,ends_on,location,remote_ok,hours_needed,
               status,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (p["id"], p["owner_id"], p["title"], p["description"],
             p["event_type"], json.dumps(p["domains"]), p["starts_on"],
             p["ends_on"], p["location"], int(p["remote_ok"]),
             p["hours_needed"], p["status"], p["expires_at"]))
        for s in p["slots"]:
            ins("""INSERT INTO slots (id,post_id,role,must_have,nice_to_have,
                   min_level,filled_by) VALUES (?,?,?,?,?,?,?)""",
                (s["id"], s["post_id"], s["role"], json.dumps(s["must_have"]),
                 json.dumps(s["nice_to_have"]), s["min_level"], s["filled_by"]))

    # Postgres sequences don't know about explicitly-inserted ids, so the
    # next signup would collide with a seeded user. Push them past the max.
    if db.USE_PG:
        for t in ("users", "posts", "slots"):
            cur.execute(
                f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {t}), 1))")

    c.commit()
    cur.close()


def ensure_schema():
    """
    Adds columns introduced after a database was first built, so an existing
    deployment doesn't need rebuilding. Safe to run on every boot.
    """
    c = db.connect()
    cur = c.cursor()

    cols = db.table_columns(c, "applications")
    if "direction" not in cols:
        cur.execute("ALTER TABLE applications "
                    "ADD COLUMN direction TEXT DEFAULT 'applied'")
    if "seen" not in cols:
        cur.execute("ALTER TABLE applications "
                    "ADD COLUMN seen INTEGER DEFAULT 0")

    if "past_projects" not in db.table_columns(c, "users"):
        cur.execute("ALTER TABLE users ADD COLUMN past_projects TEXT")
        cur.execute("UPDATE users SET past_projects='[]' "
                    "WHERE past_projects IS NULL")

    c.commit()
    cur.close()
    c.close()


# =============================================================================
# database plumbing
# =============================================================================

def conn():
    if "conn" not in g:
        g.conn = db.connect()
    return g.conn


@app.teardown_appcontext
def close_db(exc):
    c = g.pop("conn", None)
    if c:
        c.close()


def row_to_dict(row):
    """Decode the JSON-string columns back into real Python lists."""
    if row is None:
        return None
    d = db.to_dict(row)
    for k in JSON_FIELDS:
        if k in d and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except (ValueError, TypeError):
                d[k] = []
    return d


def query(statement, args=(), one=False):
    cur = conn().cursor()
    cur.execute(db.sql(statement), args)
    rows = [row_to_dict(r) for r in cur.fetchall()]
    cur.close()
    return (rows[0] if rows else None) if one else rows


def commit(statement, args=()):
    """
    Run a write. Returns the new row's id for INSERTs, which the two
    backends report differently -- db.insert_returning_id hides that.
    """
    if statement.lstrip().upper().startswith("INSERT"):
        return db.insert_returning_id(conn(), statement, args)
    cur = conn().cursor()
    cur.execute(db.sql(statement), args)
    conn().commit()
    cur.close()
    return None


def attach_owners(posts):
    """
    Adds a small owner summary to each post so browse cards can show who is
    behind a team. Cached per owner id -- a browse page is mostly a handful
    of people posting several things each.
    """
    cache = {}
    for p in posts:
        oid = p["owner_id"]
        if oid not in cache:
            cache[oid] = query(
                """SELECT id, name, role, experience_level, location,
                          bio, github, linkedin
                   FROM users WHERE id=?""", (oid,), one=True)
        p["owner"] = cache[oid]
    return posts


def get_post(post_id):
    """A post plus its slots, in the shape match.py expects."""
    post = query("SELECT * FROM posts WHERE id=?", (post_id,), one=True)
    if post:
        post["slots"] = query("SELECT * FROM slots WHERE post_id=?",
                              (post_id,))
    return post


def current_user():
    uid = session.get("uid")
    return query("SELECT * FROM users WHERE id=?", (uid,), one=True) if uid else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if not session.get("uid"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "not logged in"}), 401
            return redirect("/auth.html")
        return fn(*a, **kw)
    return wrapper


def team_context(post):
    """
    Skills and member ids already on the team -- the owner plus anyone
    accepted into a slot. This is what makes scoring marginal.
    """
    ids = [post["owner_id"]]
    ids += [s["filled_by"] for s in post["slots"] if s["filled_by"]]
    skills = []
    for uid in ids:
        u = query("SELECT skills FROM users WHERE id=?", (uid,), one=True)
        if u:
            skills += u["skills"]
    return set(skills), ids


# =============================================================================
# pages
# =============================================================================

@app.route("/")
def home():
    return send_from_directory("static", "index.html")


# =============================================================================
# auth -- plain form posts, no JS
# =============================================================================

@app.route("/signup", methods=["POST"])
def signup():
    f = request.form
    email = f.get("email", "").strip().lower()
    if not email or not f.get("password"):
        return redirect("/auth.html?error=missing")
    if query("SELECT id FROM users WHERE email=?", (email,), one=True):
        return redirect("/auth.html?error=exists")

    uid = commit(
        """INSERT INTO users (name,email,password_hash,open_to_join,
           remote_ok,willing_to_travel,hours_per_week,projects_done,
           skills,interests,experience_level)
           VALUES (?,?,?,1,1,0,10,0,'[]','[]','beginner')""",
        (f.get("name", "").strip(), email,
         generate_password_hash(f["password"])))
    session["uid"] = uid
    return redirect("/onboarding.html")


@app.route("/login", methods=["POST"])
def login():
    f = request.form
    u = query("SELECT * FROM users WHERE email=?",
              (f.get("email", "").strip().lower(),), one=True)
    if not u or not u["password_hash"] or \
            not check_password_hash(u["password_hash"], f.get("password", "")):
        return redirect("/auth.html?error=bad")
    session["uid"] = u["id"]
    return redirect("/")


if DEMO_MODE:
    @app.route("/demo-login")
    def demo_login():
        """
        Signs you in as any seeded account without a password, so both sides
        of the product can be shown without creating accounts on stage.
        Registered only when DEMO_MODE is set -- on a live deployment this
        route does not exist at all.
            /demo-login        -> the post owner
            /demo-login?id=8   -> a candidate, to show the ranked feed
        """
        session["uid"] = int(request.args.get("id", 1))
        return redirect("/")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


# =============================================================================
# profile
# =============================================================================

@app.route("/profile", methods=["POST"])
@login_required
def save_profile():
    f = request.form

    # Past projects arrive as parallel lists: project_title[] plus
    # project_skills_<i>[] and project_domains_<i>[] per row. A row with no
    # title is treated as blank and dropped.
    projects = []
    for i, title in enumerate(f.getlist("project_title")):
        title = (title or "").strip()
        if not title:
            continue
        projects.append({
            "title": title[:120],
            "skills": f.getlist(f"project_skills_{i}"),
            "domains": f.getlist(f"project_domains_{i}"),
            "outcome": f.getlist("project_outcome")[i]
                       if i < len(f.getlist("project_outcome")) else "completed",
            "duration": f.getlist("project_duration")[i]
                        if i < len(f.getlist("project_duration")) else "weeks",
            "link": (f.getlist("project_link")[i]
                     if i < len(f.getlist("project_link")) else "").strip()[:300],
        })

    commit(
        """UPDATE users SET name=?, bio=?, role=?, skills=?, interests=?,
           experience_level=?, hours_per_week=?, projects_done=?,
           past_projects=?, location=?, remote_ok=?, willing_to_travel=?,
           open_to_join=?, available_from=?, available_to=?, github=?,
           linkedin=? WHERE id=?""",
        (f.get("name"), f.get("bio"), f.get("role"),
         json.dumps(f.getlist("skills")), json.dumps(f.getlist("interests")),
         f.get("experience_level", "beginner"),
         int(f.get("hours_per_week") or 0), len(projects),
         json.dumps(projects),
         f.get("location"), 1 if f.get("remote_ok") else 0,
         1 if f.get("willing_to_travel") else 0,
         1 if f.get("open_to_join") else 0,
         f.get("available_from") or None, f.get("available_to") or None,
         f.get("github"), f.get("linkedin"), session["uid"]))

    if f.get("onboarding"):
        return redirect("/?welcome=1")
    return redirect("/profile.html?saved=1")


# =============================================================================
# posts
# =============================================================================

@app.route("/posts", methods=["POST"])
@login_required
def create_post():
    f = request.form
    post_id = commit(
        """INSERT INTO posts (owner_id,title,description,event_type,domains,
           starts_on,ends_on,location,remote_ok,hours_needed,status,expires_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,'open',?)""",
        (session["uid"], f.get("title"), f.get("description"),
         f.get("event_type"), json.dumps(f.getlist("domains")),
         f.get("starts_on") or None, f.get("ends_on") or f.get("starts_on"),
         f.get("location"), 1 if f.get("remote_ok") else 0,
         int(f.get("hours_needed") or 0), f.get("ends_on") or None))

    # role slots arrive as parallel lists: role[], must_have_0[], etc.
    for i, role in enumerate(f.getlist("role")):
        if not role:
            continue
        commit(
            """INSERT INTO slots (post_id,role,must_have,nice_to_have,
               min_level) VALUES (?,?,?,?,?)""",
            (post_id, role, json.dumps(f.getlist(f"must_have_{i}")),
             json.dumps(f.getlist(f"nice_to_have_{i}")),
             f.getlist("min_level")[i] if i < len(f.getlist("min_level"))
             else "beginner"))

    return redirect(f"/post.html?id={post_id}")


@app.route("/posts/<int:post_id>/edit", methods=["POST"])
@login_required
def edit_post(post_id):
    """
    Update a post and its slots.

    Filled slots are left alone entirely -- you can't rewrite the
    requirements for a role somebody already took. Open slots can be
    edited, added, or removed.
    """
    post = get_post(post_id)
    if not post or post["owner_id"] != session["uid"]:
        return redirect("/")

    f = request.form
    commit(
        """UPDATE posts SET title=?, description=?, event_type=?, domains=?,
           starts_on=?, ends_on=?, location=?, remote_ok=?, hours_needed=?,
           expires_at=? WHERE id=?""",
        (f.get("title"), f.get("description"), f.get("event_type"),
         json.dumps(f.getlist("domains")),
         f.get("starts_on") or None, f.get("ends_on") or f.get("starts_on"),
         f.get("location"), 1 if f.get("remote_ok") else 0,
         int(f.get("hours_needed") or 0),
         f.get("ends_on") or None, post_id))

    filled_ids = {s["id"] for s in post["slots"] if s["filled_by"]}
    kept = set(filled_ids)

    slot_ids = f.getlist("slot_id")
    roles = f.getlist("role")
    levels = f.getlist("min_level")

    for i, role in enumerate(roles):
        if not role:
            continue
        sid = slot_ids[i] if i < len(slot_ids) else ""
        must = json.dumps(f.getlist(f"must_have_{i}"))
        nice = json.dumps(f.getlist(f"nice_to_have_{i}"))
        lvl = levels[i] if i < len(levels) else "beginner"

        if sid and int(sid) in filled_ids:
            continue                      # never touch a filled slot
        if sid:
            commit("""UPDATE slots SET role=?, must_have=?, nice_to_have=?,
                      min_level=? WHERE id=? AND post_id=?""",
                   (role, must, nice, lvl, int(sid), post_id))
            kept.add(int(sid))
        else:
            new_id = commit(
                """INSERT INTO slots (post_id,role,must_have,nice_to_have,
                   min_level) VALUES (?,?,?,?,?)""",
                (post_id, role, must, nice, lvl))
            kept.add(new_id)

    # drop open slots the owner removed, and any applications hanging off them
    for s in post["slots"]:
        if s["id"] not in kept:
            commit("DELETE FROM applications WHERE slot_id=?", (s["id"],))
            commit("DELETE FROM slots WHERE id=?", (s["id"],))

    rescore_pending(post_id)
    return redirect(f"/post.html?id={post_id}&updated=1")


def rescore_pending(post_id):
    """
    Requirements changed, so scores computed against the old ones are
    stale. Recompute every pending application. Decided ones are left as
    they were -- they are a record of a decision already made.
    """
    post = get_post(post_id)
    if not post:
        return
    team_skills, team_ids = team_context(post)
    slots = {s["id"]: s for s in post["slots"]}

    for a in query("""SELECT id, slot_id, user_id FROM applications
                      WHERE post_id=? AND status='pending'""", (post_id,)):
        slot = slots.get(a["slot_id"])
        user = query("SELECT * FROM users WHERE id=?", (a["user_id"],), one=True)
        if not slot or not user:
            continue
        scored = score_candidate(user, post, slot, team_skills, team_ids)
        commit("UPDATE applications SET match_score=? WHERE id=?",
               (scored["score"] if scored else 0, a["id"]))


@app.route("/posts/<int:post_id>/status", methods=["POST"])
@login_required
def set_post_status(post_id):
    """Close a post so it stops appearing in browse and feeds, or reopen it."""
    post = query("SELECT owner_id FROM posts WHERE id=?", (post_id,), one=True)
    if not post or post["owner_id"] != session["uid"]:
        return redirect("/")
    status = "closed" if request.form.get("status") == "closed" else "open"
    commit("UPDATE posts SET status=? WHERE id=?", (status, post_id))
    return redirect("/my-posts.html")


@app.route("/apply", methods=["POST"])
@login_required
def apply():
    f = request.form
    post_id, slot_id = int(f["post_id"]), int(f["slot_id"])
    post = get_post(post_id)
    slot = next((s for s in post["slots"] if s["id"] == slot_id), None)
    me = current_user()

    team_skills, team_ids = team_context(post)
    scored = score_candidate(me, post, slot, team_skills, team_ids)

    try:
        commit(
            """INSERT INTO applications (post_id,slot_id,user_id,note,
               match_score) VALUES (?,?,?,?,?)""",
            (post_id, slot_id, me["id"], f.get("note", "")[:500],
             scored["score"] if scored else 0))
    except db.UNIQUE_ERRORS:
        conn().rollback()   # Postgres blocks further writes until rolled back
    return redirect(f"/post.html?id={post_id}&applied=1")


@app.route("/invite", methods=["POST"])
@login_required
def invite():
    """
    Owner reaches out to someone from the ranked list. Creates the same
    application row as a normal apply, but flagged direction='invited' --
    so the decision sits with the candidate instead of the owner.
    """
    f = request.form
    post_id, slot_id = int(f["post_id"]), int(f["slot_id"])
    user_id = int(f["user_id"])

    post = get_post(post_id)
    if not post or post["owner_id"] != session["uid"]:
        return redirect("/")

    slot = next((s for s in post["slots"] if s["id"] == slot_id), None)
    candidate = query("SELECT * FROM users WHERE id=?", (user_id,), one=True)
    if not slot or not candidate:
        return redirect(f"/post.html?id={post_id}")

    team_skills, team_ids = team_context(post)
    scored = score_candidate(candidate, post, slot, team_skills, team_ids)

    try:
        commit(
            """INSERT INTO applications (post_id,slot_id,user_id,note,
               status,direction,match_score) VALUES (?,?,?,?,?,?,?)""",
            (post_id, slot_id, user_id,
             f.get("note", "")[:500], "pending", "invited",
             scored["score"] if scored else 0))
    except db.UNIQUE_ERRORS:
        conn().rollback()   # already invited, or they already applied
    return redirect(f"/post.html?id={post_id}&invited=1")


@app.route("/invitations/<int:app_id>/respond", methods=["POST"])
@login_required
def respond_invite(app_id):
    """Candidate accepts or declines an invitation."""
    decision = request.form.get("decision")
    a = query("SELECT * FROM applications WHERE id=?", (app_id,), one=True)
    if not a or a["user_id"] != session["uid"] or a["direction"] != "invited":
        return redirect("/")

    if decision == "accept":
        commit("UPDATE applications SET status='accepted' WHERE id=?", (app_id,))
        commit("UPDATE slots SET filled_by=? WHERE id=?",
               (a["user_id"], a["slot_id"]))
        open_slots = query(
            "SELECT id FROM slots WHERE post_id=? AND filled_by IS NULL",
            (a["post_id"],))
        if not open_slots:
            commit("UPDATE posts SET status='closed' WHERE id=?",
                   (a["post_id"],))
    else:
        commit("UPDATE applications SET status='declined' WHERE id=?", (app_id,))

    return redirect("/invites.html?done=1")


@app.route("/api/invites")
@login_required
def api_invites():
    """Invitations addressed to the logged-in user."""
    return jsonify(query(
        """SELECT a.id, a.note, a.status, a.match_score, a.created_at,
                  p.id AS post_id, p.title, p.description, p.event_type,
                  p.starts_on, p.ends_on, p.location, p.remote_ok,
                  p.domains, s.role AS slot_role,
                  o.name AS owner_name, o.id AS owner_id
           FROM applications a
           JOIN posts p ON p.id = a.post_id
           JOIN slots s ON s.id = a.slot_id
           JOIN users o ON o.id = p.owner_id
           WHERE a.user_id=? AND a.direction='invited'
           ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END,
                    a.match_score DESC""",
        (session["uid"],)))


@app.route("/api/my-posts")
@login_required
def api_my_posts():
    """
    Everything the owner posted, each with its roster: which slots are
    filled and by whom, and how many people are still waiting on a
    decision. This is the "who is on board" view.
    """
    posts = query(
        "SELECT * FROM posts WHERE owner_id=? ORDER BY starts_on DESC",
        (session["uid"],))

    for p in posts:
        slots = query("SELECT * FROM slots WHERE post_id=?", (p["id"],))
        for s in slots:
            if s["filled_by"]:
                m = query(
                    """SELECT id, name, email, role, experience_level,
                              location, github, linkedin
                       FROM users WHERE id=?""", (s["filled_by"],), one=True)
                s["member"] = m
                # how they came to be on the team -- applied or were invited
                how = query(
                    """SELECT direction FROM applications
                       WHERE slot_id=? AND user_id=? AND status='accepted'""",
                    (s["id"], s["filled_by"]), one=True)
                s["joined_via"] = how["direction"] if how else "added"
            else:
                s["member"] = None
        p["slots"] = slots
        p["filled"] = sum(1 for s in slots if s["filled_by"])
        p["total_slots"] = len(slots)

        counts = query(
            """SELECT
                 SUM(CASE WHEN direction='applied' AND status='pending'
                          THEN 1 ELSE 0 END) AS waiting,
                 SUM(CASE WHEN direction='invited' AND status='pending'
                          THEN 1 ELSE 0 END) AS invited
               FROM applications WHERE post_id=?""", (p["id"],), one=True) or {}
        p["waiting_count"] = counts.get("waiting") or 0
        p["invited_count"] = counts.get("invited") or 0

    return jsonify(posts)


@app.route("/api/my-applications")
@login_required
def api_my_applications():
    """
    The applicant's side of the ledger. Loading this marks decisions as
    seen, which is what clears the nav badge -- the same thing an inbox
    does when you open it.
    """
    rows = query(
        """SELECT a.id, a.note, a.status, a.match_score, a.created_at,
                  p.id AS post_id, p.title, p.event_type, p.starts_on,
                  p.location, p.remote_ok, p.domains,
                  s.role AS slot_role,
                  o.id AS owner_id, o.name AS owner_name,
                  o.email AS owner_email
           FROM applications a
           JOIN posts p ON p.id = a.post_id
           JOIN slots s ON s.id = a.slot_id
           JOIN users o ON o.id = p.owner_id
           WHERE a.user_id=? AND a.direction='applied'
           ORDER BY CASE WHEN a.status<>'pending' THEN 0 ELSE 1 END,
                    a.created_at DESC""",
        (session["uid"],))

    # organiser contact details only once you're actually on the team
    for r in rows:
        if r["status"] != "accepted":
            r.pop("owner_email", None)

    commit("""UPDATE applications SET seen=1
              WHERE user_id=? AND direction='applied'""", (session["uid"],))
    return jsonify(rows)


@app.route("/applications/<int:app_id>/decide", methods=["POST"])
@login_required
def decide(app_id):
    decision = request.form.get("decision")
    a = query("""SELECT a.*, p.owner_id FROM applications a
                 JOIN posts p ON p.id = a.post_id WHERE a.id=?""",
              (app_id,), one=True)
    if not a or a["owner_id"] != session["uid"]:
        return redirect("/")

    # seen=0 makes the outcome show up as a notification for the applicant
    if decision == "accept":
        commit("UPDATE applications SET status='accepted', seen=0 WHERE id=?",
               (app_id,))
        commit("UPDATE slots SET filled_by=? WHERE id=?",
               (a["user_id"], a["slot_id"]))
        # close the post once every slot is filled
        open_slots = query(
            "SELECT id FROM slots WHERE post_id=? AND filled_by IS NULL",
            (a["post_id"],))
        if not open_slots:
            commit("UPDATE posts SET status='closed' WHERE id=?",
                   (a["post_id"],))
    else:
        commit("UPDATE applications SET status='rejected', seen=0 WHERE id=?",
               (app_id,))

    return redirect(f"/post.html?id={a['post_id']}")


# =============================================================================
# JSON API -- only for the genuinely dynamic parts
# =============================================================================

@app.route("/api/vocab")
def api_vocab():
    from match import OUTCOME_SCORE, DURATION_SCORE
    return jsonify({"roles": ROLES, "skills": SKILLS,
                    "event_types": EVENT_TYPES, "domains": DOMAINS,
                    "levels": list(LEVELS.keys()),
                    "outcomes": list(OUTCOME_SCORE.keys()),
                    "durations": list(DURATION_SCORE.keys())})


@app.route("/api/me")
def api_me():
    u = current_user()
    if not u:
        return jsonify({"logged_in": False, "demo_mode": DEMO_MODE})
    u.pop("password_hash", None)
    counts = query(
        """SELECT
             SUM(CASE WHEN direction='invited' AND status='pending'
                      THEN 1 ELSE 0 END) AS invites,
             SUM(CASE WHEN direction='applied' AND status<>'pending'
                       AND COALESCE(seen,0)=0
                      THEN 1 ELSE 0 END) AS decisions
           FROM applications WHERE user_id=?""",
        (u["id"],), one=True) or {}
    invites = counts.get("invites") or 0
    decisions = counts.get("decisions") or 0

    waiting = query(
        """SELECT COUNT(*) AS n FROM applications a
           JOIN posts p ON p.id = a.post_id
           WHERE p.owner_id=? AND a.direction='applied'
             AND a.status='pending'""",
        (u["id"],), one=True)
    complete = bool(u.get("skills") and u.get("role")
                    and u.get("available_from") and u.get("available_to"))
    return jsonify({"logged_in": True, "user": u,
                    "pending_invites": invites,
                    "new_decisions": decisions,
                    "notifications": invites + decisions,
                    "pending_applications": (waiting["n"] if waiting else 0),
                    "profile_complete": complete,
                    "demo_mode": DEMO_MODE})


@app.route("/api/feed")
@login_required
def api_feed():
    """Ranked open posts for the logged-in user. Their home page."""
    me = current_user()
    posts = [get_post(p["id"])
             for p in query("SELECT id FROM posts WHERE status='open'")]
    by_id = {p["id"]: p for p in attach_owners(posts)}

    ranked = rank_posts_for_user(me, posts)
    for r in ranked:
        src = by_id.get(r["post_id"], {})
        r["owner"] = src.get("owner")
        for k in ("event_type", "starts_on", "location", "remote_ok",
                  "domains"):
            r[k] = src.get(k)
    return jsonify(ranked)


@app.route("/api/posts")
def api_posts():
    """Browse + filter. Everything is an optional query param."""
    sql = "SELECT * FROM posts WHERE status='open'"
    args = []
    if request.args.get("event_type"):
        sql += " AND event_type=?"
        args.append(request.args["event_type"])
    if request.args.get("location"):
        sql += " AND location LIKE ?"
        args.append(f"%{request.args['location']}%")
    if request.args.get("remote_ok"):
        sql += " AND remote_ok=1"
    if request.args.get("starts_after"):
        sql += " AND starts_on >= ?"
        args.append(request.args["starts_after"])
    sql += " ORDER BY starts_on"

    posts = [get_post(p["id"]) for p in query(sql, args)]

    # role and domain filters are set operations, easier in Python
    role = request.args.get("role")
    domain = request.args.get("domain")
    if role:
        posts = [p for p in posts
                 if any(s["role"] == role and not s["filled_by"]
                        for s in p["slots"])]
    if domain:
        posts = [p for p in posts if domain in p["domains"]]

    attach_owners(posts)

    # if logged in, attach each post's score for this user
    me = current_user()
    if me:
        scores = {r["post_id"]: r for r in rank_posts_for_user(me, posts)}
        for p in posts:
            hit = scores.get(p["id"])
            p["my_score"] = hit["score"] if hit else None
            p["my_reason"] = hit["reason"] if hit else None

    return jsonify(posts)


@app.route("/api/posts/<int:post_id>")
def api_post(post_id):
    post = get_post(post_id)
    if not post:
        return jsonify({"error": "not found"}), 404
    owner = query("SELECT id,name,github,linkedin,bio FROM users WHERE id=?",
                  (post["owner_id"],), one=True)
    post["owner"] = owner
    post["is_owner"] = session.get("uid") == post["owner_id"]
    if session.get("uid"):
        post["my_applications"] = query(
            "SELECT slot_id,status FROM applications WHERE post_id=? AND user_id=?",
            (post_id, session["uid"]))
    return jsonify(post)


@app.route("/api/posts/<int:post_id>/slots/<int:slot_id>/matches")
@login_required
def api_matches(post_id, slot_id):
    """
    Ranked candidates for one slot. Owner-only -- this is the core view.
    Also returns who was dropped and why, which is worth showing.
    """
    post = get_post(post_id)
    if not post or post["owner_id"] != session["uid"]:
        return jsonify({"error": "not your post"}), 403

    slot = next((s for s in post["slots"] if s["id"] == slot_id), None)
    if not slot:
        return jsonify({"error": "no such slot"}), 404

    users = query("SELECT * FROM users")
    team_skills, team_ids = team_context(post)
    ranked = rank_candidates(users, post, slot, team_skills, team_ids,
                             limit=int(request.args.get("limit", 20)))

    # attach the bits the cards need
    by_id = {u["id"]: u for u in users}
    for r in ranked:
        u = by_id[r["user_id"]]
        r.update({"role": u["role"], "bio": u["bio"], "github": u["github"],
                  "linkedin": u["linkedin"], "location": u["location"],
                  "experience_level": u["experience_level"]})

    from match import passes_hard_filters
    dropped = []
    for u in users:
        ok, why = passes_hard_filters(u, post, slot, team_ids)
        if not ok and why not in ("is the post owner",):
            dropped.append({"name": u["name"], "reason": why})

    # who's already been contacted for this slot, so the UI can show state
    existing = query(
        "SELECT user_id, status, direction FROM applications WHERE slot_id=?",
        (slot_id,))
    contacted = {e["user_id"]: e for e in existing}
    for r in ranked:
        e = contacted.get(r["user_id"])
        r["contact_state"] = (
            f"{e['direction']}:{e['status']}" if e else None)

    return jsonify({"slot": slot, "matches": ranked,
                    "dropped_count": len(dropped), "dropped": dropped[:8]})


@app.route("/api/posts/<int:post_id>/applications")
@login_required
def api_applications(post_id):
    """Applicants sorted by match score, not by arrival time."""
    post = get_post(post_id)
    if not post or post["owner_id"] != session["uid"]:
        return jsonify({"error": "not your post"}), 403
    return jsonify(query(
        """SELECT a.id, a.slot_id, a.note, a.status, a.match_score,
                  a.direction,
                  u.id AS user_id, u.name, u.role, u.bio, u.email,
                  u.github, u.linkedin, u.experience_level, u.location,
                  s.role AS slot_role
           FROM applications a
           JOIN users u ON u.id = a.user_id
           JOIN slots s ON s.id = a.slot_id
           WHERE a.post_id=?
           ORDER BY CASE WHEN a.direction='applied' THEN 0 ELSE 1 END,
                    CASE WHEN a.status='pending' THEN 0 ELSE 1 END,
                    a.match_score DESC""", (post_id,)))


@app.route("/api/users/<int:user_id>")
def api_user(user_id):
    u = query("SELECT * FROM users WHERE id=?", (user_id,), one=True)
    if not u:
        return jsonify({"error": "not found"}), 404
    u.pop("password_hash", None)

    # Contact details are shared once two people are actually on a team
    # together. That has to work in both directions: the owner who accepted
    # someone, and the person they accepted looking back at the owner.
    me = session.get("uid", 0)
    if me != user_id:
        shared = query(
            """SELECT a.id FROM applications a
               JOIN posts p ON p.id = a.post_id
               WHERE a.status='accepted'
                 AND ((a.user_id=? AND p.owner_id=?)
                   OR (a.user_id=? AND p.owner_id=?))""",
            (user_id, me, me, user_id))
        if not shared:
            u.pop("email", None)
    return jsonify(u)


if __name__ == "__main__":
    ensure_seeded()
    ensure_schema()
    # debug=True exposes an interactive console on any error -- never on a
    # public host. Set FLASK_DEBUG=1 locally if you want the reloader.
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=debug, port=port, host="0.0.0.0" if not debug else "127.0.0.1")
