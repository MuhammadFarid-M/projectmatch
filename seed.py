"""
Seed data for ProjectMatch.

An empty platform demos as a broken platform. This file is your demo script
disguised as a data file: the first nine profiles are hand-designed so that
the ranking VISIBLY discriminates -- perfect matches, partial matches, and
several people who get dropped by hard filters for different reasons.

Run:
    python3 seed.py               # writes seed_data.json
    python3 seed.py --sqlite      # also builds projectmatch.db
"""

import json
import random
import sqlite3
import sys
from vocab import ROLES, SKILLS, EVENT_TYPES, DOMAINS

random.seed(7)  # reproducible -- your demo looks the same every run

EVENT_START = "2026-09-02"
EVENT_END = "2026-09-03"
CITY = "Chennai"


# =============================================================================
# The demo cast. Each one exists to demonstrate a specific scorer behaviour.
# =============================================================================

DEMO_USERS = [
    {
        "id": 1,
        "name": "You (post owner)",
        "email": "owner@example.com",
        "bio": "Backend developer building an IAM-flavoured hackathon project.",
        "role": "backend developer",
        "skills": ["python", "flask", "postgres", "rest apis", "docker", "git"],
        "interests": ["cybersecurity", "developer tools", "fintech"],
        "experience_level": "intermediate",
        "hours_per_week": 30,
        "projects_done": 4,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": False,
        "open_to_join": False,
        "available_from": "2026-08-20",
        "available_to": "2026-09-30",
        "github": "https://github.com/example",
        "linkedin": "https://linkedin.com/in/example",
        "past_projects": [
                {
                        "title": "Internal SSO gateway",
                        "skills": [
                                "python",
                                "flask",
                                "postgres",
                                "rest apis"
                        ],
                        "domains": [
                                "cybersecurity",
                                "developer tools"
                        ],
                        "outcome": "shipped",
                        "duration": "months",
                        "link": "https://github.com/example/sso-gateway"
                }
        ],
                "_why": "the post owner -- must be filtered out of their own results",
    },
    {
        "id": 2,
        "name": "Priya Raman",
        "email": "priya@example.com",
        "bio": "Frontend dev who likes shipping fast. Tailwind evangelist.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "tailwind",
                   "responsive design", "typescript", "git"],
        "interests": ["cybersecurity", "developer tools", "ai/llm"],
        "experience_level": "advanced",
        "hours_per_week": 35,
        "projects_done": 6,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-08-25",
        "available_to": "2026-09-15",
        "github": "https://github.com/priya",
        "linkedin": "https://linkedin.com/in/priya",
        "past_projects": [
                {
                        "title": "SOC alert triage dashboard",
                        "skills": [
                                "react",
                                "typescript",
                                "tailwind",
                                "html/css"
                        ],
                        "domains": [
                                "cybersecurity"
                        ],
                        "outcome": "shipped",
                        "duration": "months",
                        "link": "https://github.com/priya/soc-triage"
                },
                {
                        "title": "Open-source component library",
                        "skills": [
                                "react",
                                "html/css",
                                "javascript"
                        ],
                        "domains": [
                                "developer tools"
                        ],
                        "outcome": "shipped",
                        "duration": "ongoing",
                        "link": "https://github.com/priya/ui-kit"
                }
        ],
                "_why": "TOP MATCH -- every must-have, two shared domains, free, local",
    },
    {
        "id": 3,
        "name": "Arjun Menon",
        "email": "arjun@example.com",
        "bio": "React developer, three hackathons this year.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "git", "next.js"],
        "interests": ["developer tools", "gaming"],
        "experience_level": "intermediate",
        "hours_per_week": 25,
        "projects_done": 5,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-08-28",
        "available_to": "2026-09-10",
        "github": "https://github.com/arjun",
        "linkedin": "https://linkedin.com/in/arjun",
        "past_projects": [
                {
                        "title": "Campus events portal",
                        "skills": [
                                "react",
                                "javascript",
                                "next.js"
                        ],
                        "domains": [
                                "edtech"
                        ],
                        "outcome": "completed",
                        "duration": "weeks",
                        "link": "https://github.com/arjun/events"
                },
                {
                        "title": "Hackathon scoreboard app",
                        "skills": [
                                "react",
                                "javascript"
                        ],
                        "domains": [
                                "developer tools"
                        ],
                        "outcome": "award",
                        "duration": "weekend",
                        "link": "https://github.com/arjun/scoreboard"
                }
        ],
                "_why": "STRONG -- misses one nice-to-have, one shared domain",
    },
    {
        "id": 4,
        "name": "Kavya Srinivasan",
        "email": "kavya@example.com",
        "bio": "Frontend engineer focused on climate and agriculture products.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "tailwind",
                   "typescript", "accessibility", "responsive design"],
        "interests": ["climate", "agritech", "social impact"],
        "experience_level": "advanced",
        "hours_per_week": 30,
        "projects_done": 7,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-08-20",
        "available_to": "2026-09-20",
        "github": "https://github.com/kavya",
        "linkedin": "https://linkedin.com/in/kavya",
        "past_projects": [
                {
                        "title": "Rainfall monitoring dashboard",
                        "skills": [
                                "react",
                                "typescript",
                                "html/css",
                                "accessibility"
                        ],
                        "domains": [
                                "climate",
                                "agritech"
                        ],
                        "outcome": "shipped",
                        "duration": "months",
                        "link": "https://github.com/kavya/rainfall"
                },
                {
                        "title": "Farmer advisory portal",
                        "skills": [
                                "react",
                                "tailwind",
                                "responsive design"
                        ],
                        "domains": [
                                "agritech"
                        ],
                        "outcome": "completed",
                        "duration": "weeks",
                        "link": ""
                }
        ],
                "_why": "TECHNICALLY PERFECT, ZERO DOMAIN OVERLAP -- proves the "
                "interest axis actually moves the ranking",
    },
    {
        "id": 5,
        "name": "Rohit Nair",
        "email": "rohit@example.com",
        "bio": "Senior frontend engineer. Design systems nerd.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "typescript",
                   "tailwind", "design systems", "accessibility"],
        "interests": ["cybersecurity", "developer tools"],
        "experience_level": "expert",
        "hours_per_week": 20,
        "projects_done": 12,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-09-10",
        "available_to": "2026-09-30",
        "github": "https://github.com/rohit",
        "linkedin": "https://linkedin.com/in/rohit",
        "past_projects": [
                {
                        "title": "Enterprise design system",
                        "skills": [
                                "react",
                                "typescript",
                                "design systems"
                        ],
                        "domains": [
                                "developer tools"
                        ],
                        "outcome": "shipped",
                        "duration": "ongoing",
                        "link": "https://github.com/rohit/ds"
                }
        ],
                "_why": "DROPPED -- ideal on paper, but unavailable during the event",
    },
    {
        "id": 6,
        "name": "Sneha Iyer",
        "email": "sneha@example.com",
        "bio": "Frontend developer, currently heads-down on a full-time role.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "vue", "tailwind"],
        "interests": ["cybersecurity", "fintech"],
        "experience_level": "advanced",
        "hours_per_week": 5,
        "projects_done": 8,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": False,
        "open_to_join": False,
        "available_from": "2026-08-01",
        "available_to": "2026-12-31",
        "github": "https://github.com/sneha",
        "linkedin": "https://linkedin.com/in/sneha",
        "past_projects": [
                {
                        "title": "Payments admin console",
                        "skills": [
                                "vue",
                                "javascript",
                                "tailwind"
                        ],
                        "domains": [
                                "fintech"
                        ],
                        "outcome": "shipped",
                        "duration": "months",
                        "link": ""
                }
        ],
                "_why": "DROPPED -- great fit but has toggled off 'open to joining'",
    },
    {
        "id": 7,
        "name": "Vikram Das",
        "email": "vikram@example.com",
        "bio": "Frontend developer based in Bengaluru.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react", "tailwind", "next.js"],
        "interests": ["cybersecurity", "developer tools"],
        "experience_level": "advanced",
        "hours_per_week": 30,
        "projects_done": 6,
        "location": "Bengaluru",
        "remote_ok": True,
        "willing_to_travel": False,
        "open_to_join": True,
        "available_from": "2026-08-20",
        "available_to": "2026-09-30",
        "github": "https://github.com/vikram",
        "linkedin": "https://linkedin.com/in/vikram",
        "past_projects": [
                {
                        "title": "Threat-feed viewer",
                        "skills": [
                                "react",
                                "tailwind",
                                "next.js"
                        ],
                        "domains": [
                                "cybersecurity"
                        ],
                        "outcome": "completed",
                        "duration": "weeks",
                        "link": "https://github.com/vikram/threatfeed"
                }
        ],
                "_why": "DROPPED -- wrong city for an in-person event, won't travel",
    },
    {
        "id": 8,
        "name": "Ananya Krishnan",
        "email": "ananya@example.com",
        "bio": "Learning React. First hackathon, very keen.",
        "role": "frontend developer",
        "skills": ["html/css", "javascript", "react"],
        "interests": ["cybersecurity", "developer tools", "edtech"],
        "experience_level": "beginner",
        "hours_per_week": 40,
        "projects_done": 1,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-08-20",
        "available_to": "2026-09-30",
        "github": "https://github.com/ananya",
        "linkedin": "https://linkedin.com/in/ananya",
        "past_projects": [
                {
                        "title": "Personal portfolio site",
                        "skills": [
                                "html/css",
                                "javascript"
                        ],
                        "domains": [
                                "edtech"
                        ],
                        "outcome": "prototype",
                        "duration": "weekend",
                        "link": ""
                }
        ],
                "_why": "MID -- right skills and domains, but under the asked level",
    },
    {
        "id": 9,
        "name": "Deepak Subramani",
        "email": "deepak@example.com",
        "bio": "Backend engineer who can hold his own in the browser.",
        "role": "backend developer",
        "skills": ["python", "django", "postgres", "html/css", "javascript",
                   "docker", "git"],
        "interests": ["cybersecurity", "fintech"],
        "experience_level": "intermediate",
        "hours_per_week": 25,
        "projects_done": 5,
        "location": CITY,
        "remote_ok": True,
        "willing_to_travel": True,
        "open_to_join": True,
        "available_from": "2026-08-20",
        "available_to": "2026-09-30",
        "github": "https://github.com/deepak",
        "linkedin": "https://linkedin.com/in/deepak",
        "past_projects": [
                {
                        "title": "Fraud rules engine",
                        "skills": [
                                "python",
                                "django",
                                "postgres"
                        ],
                        "domains": [
                                "fintech",
                                "cybersecurity"
                        ],
                        "outcome": "shipped",
                        "duration": "months",
                        "link": "https://github.com/deepak/fraud"
                }
        ],
                "_why": "LOW -- partial frontend cover; team already has his backend "
                "skills, so marginal gain is small. Shows gap-vs-similarity.",
    },
]


# =============================================================================
# Bulk profiles -- realistic noise so the ranked list has depth
# =============================================================================

FIRST = ["Aditya", "Meera", "Karthik", "Divya", "Sanjay", "Nithya", "Rahul",
         "Lakshmi", "Varun", "Anjali", "Suresh", "Pooja", "Manoj", "Swathi",
         "Ravi", "Harini", "Gokul", "Shruti", "Naveen", "Ishita", "Tarun",
         "Bhavana", "Akash", "Riya", "Nikhil", "Sana", "Kiran", "Preethi",
         "Aravind", "Yamini", "Siddharth", "Trisha", "Vishal", "Nandini",
         "Chetan", "Aishwarya", "Pranav", "Kritika", "Sameer", "Devika",
         "Hari", "Malini"]
LAST = ["Kumar", "Sharma", "Reddy", "Pillai", "Bose", "Gupta", "Rao",
        "Verma", "Joshi", "Nayar", "Shetty", "Chandra"]
CITIES = [CITY, CITY, CITY, "Bengaluru", "Hyderabad", "Mumbai", "Pune"]

PROJECT_WORDS = ["Realtime", "Campus", "Community", "Smart", "Open",
                 "Mobile", "Automated", "Regional", "Personal", "Team"]
PROJECT_NOUNS = ["dashboard", "tracker", "portal", "scheduler", "marketplace",
                 "analytics tool", "notifier", "planner", "monitor", "assistant"]

ROLE_SKILLS = {
    "frontend developer": ["html/css", "javascript", "react", "vue",
                           "tailwind", "typescript", "responsive design",
                           "next.js", "accessibility"],
    "backend developer": ["python", "flask", "django", "node.js", "java",
                          "go", "rest apis", "sql", "postgres"],
    "fullstack developer": ["javascript", "react", "node.js", "python",
                            "postgres", "rest apis", "docker"],
    "ui/ux designer": ["figma", "wireframing", "user research",
                       "prototyping", "design systems", "illustration"],
    "data scientist": ["python", "pandas", "numpy", "scikit-learn",
                       "sql", "data viz"],
    "ml engineer": ["python", "pytorch", "tensorflow", "nlp",
                    "computer vision", "docker"],
    "devops engineer": ["docker", "kubernetes", "aws", "ci/cd", "linux"],
    "mobile developer": ["react native", "flutter", "swift", "kotlin"],
    "product manager": ["market research", "pitching", "public speaking"],
    "data engineer": ["sql", "postgres", "python", "pandas", "aws"],
}


def make_bulk(start_id, n=45):
    users = []
    names_used = set()
    for i in range(n):
        role = random.choice(list(ROLE_SKILLS.keys()))
        pool = ROLE_SKILLS[role]
        skills = random.sample(pool, k=random.randint(3, min(6, len(pool))))
        if random.random() < 0.5:
            skills.append("git")

        name = f"{random.choice(FIRST)} {random.choice(LAST)}"
        while name in names_used:
            name = f"{random.choice(FIRST)} {random.choice(LAST)}"
        names_used.add(name)

        # most people are available around the event, some aren't
        if random.random() < 0.75:
            av_from, av_to = "2026-08-15", "2026-10-15"
        else:
            av_from, av_to = "2026-09-15", "2026-11-01"

        n_proj = random.randint(0, 3)
        past = []
        for k in range(n_proj):
            past.append({
                "title": f"{random.choice(PROJECT_WORDS)} {random.choice(PROJECT_NOUNS)}",
                "skills": random.sample(pool, k=min(len(pool), random.randint(2, 4))),
                "domains": random.sample(DOMAINS, k=random.randint(1, 2)),
                "outcome": random.choice(
                    ["prototype", "completed", "completed", "shipped", "award"]),
                "duration": random.choice(
                    ["weekend", "weeks", "weeks", "months", "ongoing"]),
                "link": (f"https://github.com/user{start_id + i}/project{k}"
                         if random.random() < 0.6 else ""),
            })

        users.append({
            "id": start_id + i,
            "name": name,
            "email": f"user{start_id + i}@example.com",
            "bio": f"{role.title()} interested in building useful things.",
            "role": role,
            "skills": sorted(set(skills)),
            "interests": random.sample(DOMAINS, k=random.randint(1, 3)),
            "experience_level": random.choice(
                ["beginner", "intermediate", "intermediate",
                 "advanced", "advanced", "expert"]
            ),
            "hours_per_week": random.choice([5, 10, 15, 20, 25, 30, 40]),
            "projects_done": n_proj,
            "past_projects": past,
            "location": random.choice(CITIES),
            "remote_ok": True,
            "willing_to_travel": random.random() < 0.4,
            "open_to_join": random.random() < 0.85,
            "available_from": av_from,
            "available_to": av_to,
            "github": f"https://github.com/user{start_id + i}",
            "linkedin": f"https://linkedin.com/in/user{start_id + i}",
        })
    return users


# =============================================================================
# Posts
# =============================================================================

DEMO_POST = {
    "id": 1,
    "owner_id": 1,
    "title": "Security dashboard hackathon — need a frontend dev + designer",
    "description": (
        "Building a security-focused dashboard over the weekend. Backend and "
        "auth are handled -- I need someone to own the interface. 36-hour "
        "in-person event, team of three."
    ),
    "event_type": "hackathon",
    "domains": ["cybersecurity", "developer tools"],
    "starts_on": EVENT_START,
    "ends_on": EVENT_END,
    "location": CITY,
    "remote_ok": False,
    "hours_needed": 20,
    "status": "open",
    "expires_at": EVENT_END,
    "slots": [
        {
            "id": 1,
            "post_id": 1,
            "role": "frontend developer",
            "must_have": ["html/css", "javascript", "react"],
            "nice_to_have": ["tailwind", "typescript", "responsive design"],
            "min_level": "intermediate",
            "filled_by": None,
        },
        {
            "id": 2,
            "post_id": 1,
            "role": "ui/ux designer",
            "must_have": ["figma"],
            "nice_to_have": ["wireframing", "user research"],
            "min_level": "beginner",
            "filled_by": None,
        },
    ],
}

OTHER_POSTS = [
    {
        "id": 2, "owner_id": 12,
        "title": "Climate data viz project -- looking for a data scientist",
        "description": "Six-week research project on regional rainfall data.",
        "event_type": "research project",
        "domains": ["climate", "social impact"],
        "starts_on": "2026-09-05", "ends_on": "2026-10-20",
        "location": CITY, "remote_ok": True, "hours_needed": 10,
        "status": "open", "expires_at": "2026-09-05",
        "slots": [{
            "id": 3, "post_id": 2, "role": "data scientist",
            "must_have": ["python", "pandas"],
            "nice_to_have": ["data viz", "sql"],
            "min_level": "intermediate", "filled_by": None,
        }],
    },
    {
        "id": 3, "owner_id": 18,
        "title": "Early-stage fintech startup -- backend + design",
        "description": "Pre-seed, building a payments reconciliation tool.",
        "event_type": "startup",
        "domains": ["fintech", "developer tools"],
        "starts_on": "2026-09-01", "ends_on": "2026-12-31",
        "location": CITY, "remote_ok": True, "hours_needed": 15,
        "status": "open", "expires_at": "2026-10-01",
        "slots": [
            {"id": 4, "post_id": 3, "role": "backend developer",
             "must_have": ["python", "postgres"], "nice_to_have": ["docker"],
             "min_level": "intermediate", "filled_by": None},
            {"id": 5, "post_id": 3, "role": "ui/ux designer",
             "must_have": ["figma"], "nice_to_have": ["prototyping"],
             "min_level": "beginner", "filled_by": None},
        ],
    },
]


# =============================================================================
# output
# =============================================================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  bio TEXT,
  role TEXT,
  skills TEXT,            -- json array
  interests TEXT,         -- json array
  experience_level TEXT,
  hours_per_week INTEGER,
  projects_done INTEGER,
  past_projects TEXT,     -- json array of {title, skills[], domains[]}
  location TEXT,
  remote_ok INTEGER,
  willing_to_travel INTEGER,
  open_to_join INTEGER DEFAULT 1,
  available_from TEXT,
  available_to TEXT,
  github TEXT,
  linkedin TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT,
  domains TEXT,           -- json array
  starts_on TEXT,
  ends_on TEXT,
  location TEXT,
  remote_ok INTEGER,
  hours_needed INTEGER,
  status TEXT DEFAULT 'open',
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  role TEXT NOT NULL,
  must_have TEXT,         -- json array
  nice_to_have TEXT,      -- json array
  min_level TEXT,
  filled_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  slot_id INTEGER NOT NULL REFERENCES slots(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT,
  status TEXT DEFAULT 'pending',
  direction TEXT DEFAULT 'applied',   -- 'applied' or 'invited'
  match_score INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slot_id, user_id)
);
"""


def build():
    users = DEMO_USERS + make_bulk(start_id=10, n=45)
    posts = [DEMO_POST] + OTHER_POSTS
    return {"users": users, "posts": posts}


def write_json(data, path="seed_data.json"):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"wrote {path}: {len(data['users'])} users, "
          f"{len(data['posts'])} posts")


DROP_ALL = """
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS slots;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS users;
"""


def write_sqlite(data, path="projectmatch.db"):
    conn = sqlite3.connect(path)
    conn.executescript(DROP_ALL + SCHEMA)

    for u in data["users"]:
        conn.execute(
            """INSERT INTO users (id,name,email,bio,role,skills,interests,
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
        conn.execute(
            """INSERT INTO posts (id,owner_id,title,description,event_type,
               domains,starts_on,ends_on,location,remote_ok,hours_needed,
               status,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (p["id"], p["owner_id"], p["title"], p["description"],
             p["event_type"], json.dumps(p["domains"]), p["starts_on"],
             p["ends_on"], p["location"], int(p["remote_ok"]),
             p["hours_needed"], p["status"], p["expires_at"]))
        for s in p["slots"]:
            conn.execute(
                """INSERT INTO slots (id,post_id,role,must_have,nice_to_have,
                   min_level,filled_by) VALUES (?,?,?,?,?,?,?)""",
                (s["id"], s["post_id"], s["role"], json.dumps(s["must_have"]),
                 json.dumps(s["nice_to_have"]), s["min_level"],
                 s["filled_by"]))

    conn.commit()
    conn.close()
    print(f"wrote {path}")


if __name__ == "__main__":
    data = build()
    write_json(data)
    if "--sqlite" in sys.argv:
        write_sqlite(data)
