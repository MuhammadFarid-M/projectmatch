"""
Controlled vocabulary for ProjectMatch.

Everything the user picks is chosen from these lists. No free-text skills.
This is what makes matching a set operation instead of a string-similarity
problem, and it is the single biggest time-saver in the whole build.

Render these as multi-select checkboxes / tag pickers in your HTML forms.
"""

# --- Roles: what slot a person fills on a team -------------------------------
ROLES = [
    "frontend developer",
    "backend developer",
    "fullstack developer",
    "mobile developer",
    "ui/ux designer",
    "data scientist",
    "ml engineer",
    "data engineer",
    "devops engineer",
    "product manager",
    "domain expert",
    "researcher",
    "business/pitch",
]

# --- Skills: concrete, checkable capabilities --------------------------------
SKILLS = [
    # frontend
    "html/css", "javascript", "typescript", "react", "vue", "tailwind",
    "next.js", "responsive design", "accessibility",
    # backend
    "python", "flask", "django", "fastapi", "node.js", "express",
    "java", "go", "rest apis", "graphql", "websockets",
    # data / ml
    "sql", "postgres", "mongodb", "pandas", "numpy", "scikit-learn",
    "pytorch", "tensorflow", "nlp", "computer vision", "data viz",
    # infra
    "docker", "kubernetes", "aws", "gcp", "ci/cd", "linux",
    # design
    "figma", "wireframing", "user research", "prototyping",
    "design systems", "illustration",
    # mobile
    "react native", "flutter", "swift", "kotlin",
    # other
    "git", "technical writing", "public speaking", "pitching",
    "market research", "financial modelling",
]

# --- Event types: what kind of thing is being formed -------------------------
EVENT_TYPES = [
    "hackathon",
    "competition",
    "research project",
    "startup",
    "open source",
    "side project",
    "course project",
]

# --- Domains: subject matter. This is the "like-minded" axis. ----------------
DOMAINS = [
    "healthtech", "fintech", "edtech", "climate", "agritech",
    "developer tools", "cybersecurity", "gaming", "social impact",
    "e-commerce", "logistics", "accessibility", "ai/llm",
    "iot/hardware", "civic tech",
]

# --- Experience levels: ordinal, 1..4 ----------------------------------------
LEVELS = {
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
    "expert": 4,
}
LEVEL_NAMES = {v: k for k, v in LEVELS.items()}
