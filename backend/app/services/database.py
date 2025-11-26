"""Local SQLite database service to replace Supabase."""

import aiosqlite
import os
from typing import Any, Dict, List, Optional
from datetime import datetime


class LocalDatabase:
  """SQLite database wrapper for local development."""

  def __init__(self, db_path: str = "amma_health.db"):
    self.db_path = db_path
    self._conn: Optional[aiosqlite.Connection] = None

  async def connect(self):
    """Initialize database connection and create tables if needed."""
    self._conn = await aiosqlite.connect(self.db_path)
    await self._init_schema()
    return self

  async def close(self):
    """Close database connection."""
    if self._conn:
      await self._conn.close()

  async def _init_schema(self):
    """Create tables if they don't exist."""
    await self._conn.execute("""
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('patient', 'doctor')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    """)

    await self._conn.execute("""
      CREATE TABLE IF NOT EXISTS epic_patient_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_email TEXT NOT NULL,
        patient_email TEXT,
        epic_patient_id TEXT NOT NULL,
        epic_mrn TEXT,
        patient_name TEXT,
        patient_dob DATE,
        clinical_notes TEXT,
        diagnoses TEXT,
        medications TEXT,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_email, epic_patient_id)
      )
    """)

    await self._conn.execute("""
      CREATE TABLE IF NOT EXISTS patient_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_email TEXT NOT NULL,
        patient_email TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('file', 'video')),
        file_url TEXT NOT NULL,
        file_name TEXT,
        extracted_text TEXT,
        case_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    """)

    await self._conn.execute("CREATE INDEX IF NOT EXISTS idx_patient_files_email ON patient_files(patient_email)")
    await self._conn.execute("CREATE INDEX IF NOT EXISTS idx_patient_files_case_key ON patient_files(case_key)")
    await self._conn.execute("CREATE INDEX IF NOT EXISTS idx_epic_patient_email ON epic_patient_data(patient_email)")

    await self._conn.commit()

  async def fetch_one(self, table: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fetch a single row from a table."""
    if not filters:
      return None

    where_clause = " AND ".join([f"{k} = ?" for k in filters.keys()])
    query = f"SELECT * FROM {table} WHERE {where_clause} LIMIT 1"

    async with self._conn.execute(query, list(filters.values())) as cursor:
      row = await cursor.fetchone()
      if not row:
        return None

      columns = [desc[0] for desc in cursor.description]
      return dict(zip(columns, row))

  async def fetch_all(self, table: str, filters: Dict[str, Any], order_by: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch multiple rows from a table."""
    query = f"SELECT * FROM {table}"
    params = []

    if filters:
      where_clause = " AND ".join([f"{k} = ?" for k in filters.keys()])
      query += f" WHERE {where_clause}"
      params.extend(list(filters.values()))

    if order_by:
      query += f" ORDER BY {order_by} DESC"

    if limit:
      query += f" LIMIT {limit}"

    async with self._conn.execute(query, params) as cursor:
      rows = await cursor.fetchall()
      columns = [desc[0] for desc in cursor.description]
      return [dict(zip(columns, row)) for row in rows]

  async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a row and return it."""
    columns = ", ".join(data.keys())
    placeholders = ", ".join(["?" for _ in data])
    query = f"INSERT OR IGNORE INTO {table} ({columns}) VALUES ({placeholders})"

    cursor = await self._conn.execute(query, list(data.values()))
    await self._conn.commit()

    # Fetch the inserted row - handle different primary key types
    last_id = cursor.lastrowid
    if last_id:
      # Table has auto-increment ID
      return await self.fetch_one(table, {"id": last_id})
    elif table == "users" and "email" in data:
      # Users table uses email as primary key
      return await self.fetch_one(table, {"email": data["email"]})
    else:
      # Return the data we inserted
      return data

  async def execute(self, query: str, params: tuple = ()):
    """Execute a raw SQL query."""
    await self._conn.execute(query, params)
    await self._conn.commit()

