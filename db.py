"""
Database layer.

One job: let the same application code run against SQLite on your laptop and
Postgres on Render, without a single query being written twice.

Why both? Render's free web services have an ephemeral filesystem — the
container is rebuilt every time the service redeploys, restarts, or spins
down after 15 minutes of inactivity. A SQLite file does not survive that, so
accounts vanish. A Render Postgres database is a separate service that isn't
wiped, so data persists.

Locally you want none of that ceremony, so if DATABASE_URL isn't set this
falls straight back to the SQLite file.

The differences that actually matter between the two:
  - placeholders:  SQLite uses ?, Postgres uses %s
  - auto ids:      SQLite has lastrowid, Postgres needs RETURNING id
  - rows:          sqlite3.Row vs RealDictCursor
  - failed writes: Postgres poisons the whole transaction until you roll back
Everything else in the schema is portable as written.
"""

import os
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

SQLITE_PATH = os.environ.get("PROJECTMATCH_DB", "projectmatch.db")

if USE_PG:
    import psycopg2
    import psycopg2.extras
    UNIQUE_ERRORS = (psycopg2.IntegrityError,)
else:
    UNIQUE_ERRORS = (sqlite3.IntegrityError,)


def connect():
    """Open a connection with dict-like rows in both backends."""
    if USE_PG:
        # Render hands out postgres:// ; psycopg2 wants postgresql://
        url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        return psycopg2.connect(
            url, cursor_factory=psycopg2.extras.RealDictCursor)

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def sql(statement):
    """Translate ?-style placeholders for Postgres."""
    return statement.replace("?", "%s") if USE_PG else statement


def to_dict(row):
    return dict(row) if row is not None else None


def insert_returning_id(conn, statement, args):
    """
    INSERT and get the new row's id, whichever backend is underneath.
    Postgres has no lastrowid, so it needs RETURNING; SQLite has no
    RETURNING in older versions, so it uses lastrowid.
    """
    cur = conn.cursor()
    if USE_PG:
        cur.execute(sql(statement.rstrip().rstrip(";")) + " RETURNING id", args)
        row = cur.fetchone()
        new_id = row["id"] if row else None
    else:
        cur.execute(statement, args)
        new_id = cur.lastrowid
    conn.commit()
    cur.close()
    return new_id


def table_columns(conn, table):
    """Column names for a table — used by the startup migration check."""
    cur = conn.cursor()
    if USE_PG:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s", (table,))
        cols = [r["column_name"] for r in cur.fetchall()]
    else:
        cur.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
    cur.close()
    return cols


def table_exists(conn, table):
    cur = conn.cursor()
    try:
        if USE_PG:
            cur.execute("SELECT to_regclass(%s) AS t", ('public.' + table,))
            row = cur.fetchone()
            return bool(row and row["t"])
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,))
        return cur.fetchone() is not None
    finally:
        cur.close()


def pg_schema(sqlite_schema):
    """
    Convert the SQLite DDL in seed.py to Postgres.

    The only real difference is auto-assigned ids. SQLite treats any
    "INTEGER PRIMARY KEY" column as an alias for its rowid and fills it in
    for you; Postgres does not, so an insert without an explicit id fails on
    a not-null violation. SERIAL gives the same behaviour and still accepts
    explicit ids, which the seed data relies on.
    """
    return (sqlite_schema
            .replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            .replace("INTEGER PRIMARY KEY", "SERIAL PRIMARY KEY"))


def build_schema(conn, sqlite_schema):
    """Create every table from scratch. Only ever runs on an empty database."""
    ddl = pg_schema(sqlite_schema) if USE_PG else sqlite_schema
    cur = conn.cursor()
    for statement in ddl.split(";"):
        if statement.strip():
            cur.execute(statement)
    conn.commit()
    cur.close()
