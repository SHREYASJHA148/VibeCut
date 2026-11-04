"""Local, redacted high-signal credential scan of source files and Git history."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "node_modules", "android", "ios", ".expo", ".venv", ".security-venv", "__pycache__", "test-results", "dist", "dist-final", "dist-android", "web-dist"}
PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "GitHub token": re.compile(r"\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{70,})\b"),
    "Stripe live key": re.compile(r"\bsk_live_[A-Za-z0-9]{20,}\b"),
}
findings = []
for path in ROOT.rglob("*"):
    if any(part in SKIP for part in path.relative_to(ROOT).parts) or not path.is_file() or path.stat().st_size > 4_000_000:
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    for label, pattern in PATTERNS.items():
        for match in pattern.finditer(content):
            findings.append(f"{path.relative_to(ROOT)}:{content.count(chr(10), 0, match.start()) + 1}: {label}")
repository = ROOT if (ROOT / ".git").exists() else ROOT / "mobile"
head = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=repository, capture_output=True, check=False)
history = ""
if head.returncode == 0:
    history = subprocess.run(["git", "log", "--all", "--format=", "-p"], cwd=repository, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout
for label, pattern in PATTERNS.items():
    if pattern.search(history):
        findings.append(f"mobile Git history: {label}")
print("\n".join(findings) if findings else "No high-signal credential patterns found in scanned source or Git history.")
raise SystemExit(bool(findings))
