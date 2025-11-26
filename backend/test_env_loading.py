"""Test script to verify .env file loading."""

import os
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Try loading .env
backend_dir = Path(__file__).parent.resolve()
env_file = backend_dir / ".env"

print(f"Backend directory: {backend_dir}")
print(f"Looking for .env at: {env_file}")
print(f".env file exists: {env_file.exists()}")

if env_file.exists():
    print(f"\nLoading .env from: {env_file}")
    result = load_dotenv(dotenv_path=str(env_file), override=True)
    print(f"load_dotenv returned: {result}")
else:
    print("\n.env file not found, trying current directory...")
    load_dotenv(override=True)

print(f"\nCurrent working directory: {os.getcwd()}")
print(f"\nEnvironment variables:")
print(f"  OPENAI_API_KEY: {'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
if os.getenv('OPENAI_API_KEY'):
    key = os.getenv('OPENAI_API_KEY')
    print(f"    Length: {len(key)}")
    print(f"    First 20 chars: {key[:20]}...")
    print(f"    Last 20 chars: ...{key[-20:]}")

print(f"  DATABASE_PATH: {os.getenv('DATABASE_PATH', 'NOT SET')}")
print(f"  STORAGE_DIR: {os.getenv('STORAGE_DIR', 'NOT SET')}")
print(f"  OPENAI_MODEL: {os.getenv('OPENAI_MODEL', 'NOT SET')}")

