import sys
from pathlib import Path

# The helper is a plain script, not a package: make it importable as `refresh`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
