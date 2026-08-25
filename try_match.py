"""
Terminal harness. Run this BEFORE you write any HTML.

    python3 try_match.py

If the ranking looks wrong here it's a five-minute fix. If you discover it's
wrong at hour three with a UI wrapped around it, you're finished.
"""

import json
from match import rank_candidates, rank_posts_for_user, score_candidate
from seed import build

data = build()
users = data["users"]
post = data["posts"][0]
slot = post["slots"][0]          # the frontend developer slot
by_id = {u["id"]: u for u in users}

# the team already has the owner on it -- his skills are covered
team_skills = by_id[1]["skills"]
team_ids = [1]

print("=" * 74)
print(f"POST: {post['title']}")
print(f"SLOT: {slot['role']}  |  must-have: {', '.join(slot['must_have'])}")
print("=" * 74)

ranked = rank_candidates(users, post, slot, team_skills, team_ids)

print(f"\n{len(ranked)} candidates passed hard filters "
      f"(out of {len(users)} users)\n")

for r in ranked[:10]:
    print(f"  {r['score']:>3}%  {r['name']}")
    print(f"        {r['reason']}")

print("\n" + "-" * 74)
print("DROPPED BY HARD FILTERS (the demo cast)")
print("-" * 74)
for u in users[:9]:
    if score_candidate(u, post, slot, team_skills, team_ids) is None:
        from match import passes_hard_filters
        _, why = passes_hard_filters(u, post, slot, team_ids)
        print(f"  {u['name']:<22} {why}")

print("\n" + "-" * 74)
print("BREAKDOWN for the top match")
print("-" * 74)
top = ranked[0]
for k, v in top["breakdown"].items():
    bar = "#" * (v // 5)
    print(f"  {k:<20} {v:>3}%  {bar}")

print("\n" + "-" * 74)
print("REVERSE DIRECTION -- ranked feed for Ananya (id 8)")
print("-" * 74)
for r in rank_posts_for_user(by_id[8], data["posts"]):
    print(f"  {r['score']:>3}%  {r['role']:<20} {r['title'][:40]}")
