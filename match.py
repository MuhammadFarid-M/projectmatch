"""
ProjectMatch scoring engine.

Pure functions, no database, no Flask, no dependencies outside the stdlib.
That means you can test the whole thing from the terminal before any UI
exists -- which is exactly what you should do.

Core idea: score a candidate against the team's REMAINING GAP, not against
the person asking. Someone excellent whose skills the team already has
scores low, and that is correct behaviour.

Usage:
    from match import rank_candidates
    ranked = rank_candidates(users, post, slot)
    for r in ranked[:10]:
        print(r["score"], r["name"], "--", r["reason"])
"""

from datetime import date
from vocab import LEVELS, LEVEL_NAMES

# --- Weights. Gap coverage dominates on purpose: that is what makes this a
# --- team-formation tool rather than a people search.
W_GAP        = 0.40
W_RELEVANCE  = 0.20   # do their past projects actually resemble this work?
W_INTEREST   = 0.15
W_EXPERIENCE = 0.15
W_COMMITMENT = 0.10

MUST_HAVE_WEIGHT = 2
NICE_TO_HAVE_WEIGHT = 1

# A candidate covering none of the must-haves gets multiplied down. Without
# this, someone with zero relevant skills can still reach ~48% on domain
# overlap and track record alone -- which looks broken to a judge who reads
# the list. Tune between 0.4 and 0.7 to taste.
NO_MUST_HAVE_PENALTY = 0.55

# Inside one past project, how much of its relevance comes from matching
# skills vs matching domain.
PROJ_SKILL_SHARE = 0.7
PROJ_DOMAIN_SHARE = 0.3

# --- Project depth ------------------------------------------------------
# There is no honest way to measure "quality" from a self-reported form --
# ask someone to rate their own project and everyone picks 9. What we can
# read are proxies for substance: did it ship, how long did it run, and is
# there a link somebody could actually open. All still self-reported, but
# the link is checkable, which is what makes it worth anything at all.
#
# Depth MODULATES relevance rather than adding to it, between 0.6x and
# 1.0x. That ordering is deliberate: a deep but irrelevant project must
# never outrank a relevant one.
OUTCOME_SCORE = {
    "prototype": 0.25,
    "completed": 0.55,
    "shipped": 0.85,       # real users
    "award": 1.0,          # placed in a hackathon or competition
}
DURATION_SCORE = {
    "weekend": 0.3,
    "weeks": 0.6,
    "months": 0.9,
    "ongoing": 1.0,
}
DEPTH_FLOOR = 0.6          # a no-detail project keeps 60% of its relevance


# =============================================================================
# helpers
# =============================================================================

def _as_date(value):
    """Accept 'YYYY-MM-DD' or a date object. SQLite hands you strings."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _level(value):
    """Accept 'intermediate' or 2."""
    if isinstance(value, int):
        return value
    return LEVELS.get(str(value).lower(), 1)


def _pct(x):
    return int(round(x * 100))


# =============================================================================
# hard filters -- these DROP a candidate rather than lowering their score
# =============================================================================

def passes_hard_filters(user, post, slot, team_member_ids=()):
    """
    Returns (True, None) or (False, "human readable reason").

    Cheap, unambiguous disqualifiers. Running these first also keeps the
    scoring loop small, which matters not at all at 50 rows but reads well
    when a judge asks about scale.
    """
    if user["id"] == post["owner_id"]:
        return False, "is the post owner"

    if user["id"] in team_member_ids:
        return False, "already on the team"

    if not user.get("open_to_join", True):
        return False, "not currently open to joining"

    # availability must cover the event window
    ev_start = _as_date(post.get("starts_on"))
    ev_end = _as_date(post.get("ends_on")) or ev_start
    av_from = _as_date(user.get("available_from"))
    av_to = _as_date(user.get("available_to"))

    if ev_start and av_from and av_to:
        if av_from > ev_start or av_to < ev_end:
            return False, "not available during the event"

    # location: if the post is in-person, candidate must be in the same city
    # (or explicitly willing to travel)
    if not post.get("remote_ok", False):
        same_city = (
            user.get("location", "").strip().lower()
            == post.get("location", "").strip().lower()
        )
        if not same_city and not user.get("willing_to_travel", False):
            return False, "not in the event city"

    return True, None


# =============================================================================
# scoring components -- each returns 0.0 .. 1.0
# =============================================================================

def gap_coverage(user_skills, slot, team_skills=()):
    """
    THE important one.

    Build the weighted set of skills this slot needs, remove anything the
    team already has, then measure how much of what remains this candidate
    covers. Must-haves count double.
    """
    user_skills = set(user_skills)
    team_skills = set(team_skills)

    needed = {}
    for s in slot.get("must_have", []):
        needed[s] = MUST_HAVE_WEIGHT
    for s in slot.get("nice_to_have", []):
        needed.setdefault(s, NICE_TO_HAVE_WEIGHT)

    # marginal gain: only count what the team is still missing
    remaining = {s: w for s, w in needed.items() if s not in team_skills}

    # if the team already covers everything, fall back to raw requirements
    # so the slot doesn't score every candidate a perfect 1.0
    scoring_set = remaining if remaining else needed
    total = sum(scoring_set.values())
    if total == 0:
        return 0.0, [], []

    covered = [s for s in scoring_set if s in user_skills]
    missing = [s for s in scoring_set if s not in user_skills]
    got = sum(scoring_set[s] for s in covered)

    return got / total, covered, missing


def interest_overlap(user_domains, post_domains):
    """
    Jaccard similarity on domain tags. This is the ONLY place similarity
    belongs -- it keeps you from matching someone technically perfect who
    has no interest in what you're building.
    """
    a, b = set(user_domains), set(post_domains)
    if not a or not b:
        return 0.0, []
    shared = a & b
    return len(shared) / len(a | b), sorted(shared)


def experience_fit(user_level, slot_min_level):
    """
    Penalise under-level hard, over-level only mildly. Someone far above the
    asked level is usually a mismatch of expectations rather than a bad fit.
    """
    u, m = _level(user_level), _level(slot_min_level)
    if u == m:
        return 1.0
    if u == m + 1:
        return 0.95
    if u > m + 1:
        return 0.85
    if u == m - 1:
        return 0.50
    return 0.15


def commitment_fit(user_hours, post_hours_needed):
    """Declared hours/week against what the project needs."""
    if not post_hours_needed:
        return 1.0
    return min(1.0, (user_hours or 0) / post_hours_needed)


def project_depth(project):
    """
    How substantial does this project look? Outcome, how long it ran, and
    whether there's a link to inspect. Returns 0..1.
    """
    outcome = OUTCOME_SCORE.get(project.get("outcome"), 0.4)
    duration = DURATION_SCORE.get(project.get("duration"), 0.5)
    evidence = 1.0 if str(project.get("link") or "").startswith("http") else 0.0
    return 0.45 * outcome + 0.30 * duration + 0.25 * evidence


def project_relevance(past_projects, slot, post):
    """
    Do their previous projects actually resemble THIS work?

    A bare project count is nearly worthless -- "six projects" tells you
    nothing about whether any of them look like what you need. So each past
    project is scored on two things: how much of this slot's skill list it
    used, and whether it sat in a domain this post cares about. That fit is
    then scaled by how substantial the project looks (see project_depth).

    Depth beats breadth: the single best-matching project carries 70% of
    the component, the second-best 30%. One genuinely relevant project is
    worth more than five unrelated ones, which is how a human would read
    a portfolio.

    Returns (score, best_project_or_None).
    """
    if not past_projects:
        return 0.0, None

    slot_skills = set(slot.get("must_have", [])) | set(slot.get("nice_to_have", []))
    post_domains = set(post.get("domains", []))

    scored = []
    for p in past_projects:
        if not isinstance(p, dict):
            continue
        p_skills = set(p.get("skills", []))
        p_domains = set(p.get("domains", []))

        skill_hit = (len(p_skills & slot_skills) / len(slot_skills)
                     if slot_skills else 0.0)
        domain_hit = 1.0 if (p_domains & post_domains) else 0.0
        fit = PROJ_SKILL_SHARE * skill_hit + PROJ_DOMAIN_SHARE * domain_hit

        # depth scales fit; it never rescues an irrelevant project
        depth = project_depth(p)
        scored.append((fit * (DEPTH_FLOOR + (1 - DEPTH_FLOOR) * depth), p))

    if not scored:
        return 0.0, None

    scored.sort(key=lambda x: x[0], reverse=True)
    best = scored[0]
    second = scored[1][0] if len(scored) > 1 else 0.0
    total = min(1.0, 0.7 * best[0] + 0.3 * second)

    return total, (best[1] if best[0] > 0 else None)


# =============================================================================
# reason string -- the highest value-per-minute feature in the whole app
# =============================================================================

def build_reason(covered, missing, shared_domains, user, slot, post,
                 best_project=None):
    """
    Judges reward matching they can audit. A bare number looks arbitrary;
    a number with a reason looks intelligent. This is ~20 lines of string
    templating and it is worth more than any algorithm upgrade.
    """
    parts = []

    must = set(slot.get("must_have", []))
    covered_must = [s for s in covered if s in must]
    if must:
        parts.append(
            f"covers {len(covered_must)} of {len(must)} must-haves"
            + (f" ({', '.join(covered_must[:3])})" if covered_must else "")
        )

    extras = [s for s in covered if s not in must]
    if extras:
        parts.append(f"also brings {', '.join(extras[:2])}")

    if best_project:
        title = best_project.get("title", "a past project")
        outcome = best_project.get("outcome")
        tail = {"award": " (placed)", "shipped": " (shipped)"}.get(outcome, "")
        parts.append(f"built “{title}”{tail}")

    if shared_domains:
        parts.append(f"shares interest in {', '.join(shared_domains[:2])}")

    lvl = LEVEL_NAMES.get(_level(user.get("experience_level")), "unknown")
    parts.append(f"{lvl} level")

    hrs = user.get("hours_per_week")
    if hrs:
        parts.append(f"{hrs} hrs/week free")

    if missing:
        parts.append(f"gap: {', '.join(missing[:2])}")

    return " · ".join(parts)


# =============================================================================
# the public API
# =============================================================================

def score_candidate(user, post, slot, team_skills=(), team_member_ids=()):
    """
    Returns a dict with score, reason, and the component breakdown --
    or None if the candidate fails a hard filter.

    Keeping the breakdown around costs nothing and lets you build a
    'why this score?' expander in the UI, which demos extremely well.
    """
    ok, why_not = passes_hard_filters(user, post, slot, team_member_ids)
    if not ok:
        return None

    gap, covered, missing = gap_coverage(
        user.get("skills", []), slot, team_skills
    )
    interest, shared = interest_overlap(
        user.get("interests", []), post.get("domains", [])
    )
    exp = experience_fit(
        user.get("experience_level"), slot.get("min_level", "beginner")
    )
    commit = commitment_fit(
        user.get("hours_per_week"), post.get("hours_needed")
    )
    relevance, best_project = project_relevance(
        user.get("past_projects", []), slot, post
    )

    total = (
        W_GAP * gap
        + W_RELEVANCE * relevance
        + W_INTEREST * interest
        + W_EXPERIENCE * exp
        + W_COMMITMENT * commit
    )

    must = set(slot.get("must_have", []))
    if must and not (must & set(user.get("skills", []))):
        total *= NO_MUST_HAVE_PENALTY

    return {
        "user_id": user["id"],
        "name": user.get("name"),
        "score": _pct(total),
        "reason": build_reason(covered, missing, shared, user, slot, post,
                               best_project),
        "breakdown": {
            "gap coverage": _pct(gap),
            "relevant projects": _pct(relevance),
            "shared interests": _pct(interest),
            "experience fit": _pct(exp),
            "availability": _pct(commit),
        },
        "covered": covered,
        "missing": missing,
        "best_project": best_project,
    }


def rank_candidates(users, post, slot, team_skills=(), team_member_ids=(),
                    limit=None, min_score=0):
    """Score everyone, drop the filtered-out, sort best first."""
    results = []
    for u in users:
        r = score_candidate(u, post, slot, team_skills, team_member_ids)
        if r and r["score"] >= min_score:
            results.append(r)
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit] if limit else results


def rank_posts_for_user(user, posts, limit=None, min_score=0):
    """
    The reverse direction. This is what turns your logged-in home page from
    an empty search box into a ranked feed -- same engine, arguments flipped.
    Scores the user against each post's best-fitting open slot.
    """
    results = []
    for post in posts:
        if post.get("status") != "open":
            continue
        best = None
        for slot in post.get("slots", []):
            if slot.get("filled_by"):
                continue
            r = score_candidate(user, post, slot)
            if r and (best is None or r["score"] > best["score"]):
                best = dict(r, slot_id=slot.get("id"), role=slot.get("role"))
        if best and best["score"] >= min_score:
            results.append({
                "post_id": post["id"],
                "title": post["title"],
                "role": best["role"],
                "slot_id": best["slot_id"],
                "score": best["score"],
                "reason": best["reason"],
            })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit] if limit else results
