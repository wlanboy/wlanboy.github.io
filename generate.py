import base64
import json
import os
import re
import time

import requests

GITHUB_USER = "wlanboy"
TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Accept": "application/vnd.github+json"}
if TOKEN:
    HEADERS["Authorization"] = f"token {TOKEN}"

EXCLUDED_FILENAMES = {
    "changelog", "contributing", "license", "code_of_conduct",
    "security", "authors", "maintainers", "codeowners",
    "pull_request_template", "issue_template", "funding",
}

API_KEYWORDS = {"api", "api-reference", "openapi", "swagger"}
GUIDE_KEYWORDS = {"guide", "tutorial", "howto", "how-to", "getting-started"}

MAX_DESCRIPTION_LENGTH = 300
MAX_TITLE_LENGTH = 150
MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 2
MAX_RATE_LIMIT_WAIT_SECONDS = 300


def log(msg):
    print(f"[INFO] {msg}")


def safe_get(url):
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
        except requests.exceptions.RequestException as e:
            log(f"❌ Netzwerkfehler bei {url}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
                continue
            return None

        if response.status_code == 403 and response.headers.get("X-RateLimit-Remaining") == "0":
            reset = response.headers.get("X-RateLimit-Reset")
            wait = int(reset) - int(time.time()) if reset else 60
            wait = min(max(wait, 1), MAX_RATE_LIMIT_WAIT_SECONDS)
            log(f"⏳ Rate-Limit erreicht, warte {wait}s: {url}")
            time.sleep(wait)
            continue

        if response.status_code >= 500 and attempt < MAX_RETRIES:
            log(f"⚠️  Serverfehler {response.status_code} bei {url}, retry...")
            time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
            continue

        return response

    return None


def get_repos(user):
    repos = []
    page = 1

    while True:
        url = f"https://api.github.com/users/{user}/repos?per_page=100&type=public&page={page}"
        response = safe_get(url)
        if response is None:
            break

        log(f"GitHub API Status (Seite {page}): {response.status_code}")

        try:
            data = response.json()
        except requests.exceptions.JSONDecodeError:
            log("❌ API‑Antwort ist kein gültiges JSON")
            break

        if isinstance(data, dict) and "message" in data:
            log(f"❌ GitHub API Fehler: {data['message']}")
            break

        if not isinstance(data, list):
            log("❌ Unerwartetes API‑Format (keine Liste)")
            break

        if not data:
            break

        repos.extend(data)

        if len(data) < 100:
            break

        page += 1

    return repos


def get_repo_tree(user, repo_name, branch):
    url = f"https://api.github.com/repos/{user}/{repo_name}/git/trees/{branch}?recursive=1"
    response = safe_get(url)

    if response is None:
        return []

    if response.status_code != 200:
        log(f"⚠️  Konnte Tree für {repo_name} nicht laden (Status {response.status_code})")
        return []

    try:
        data = response.json()
    except requests.exceptions.JSONDecodeError:
        log(f"❌ Tree‑Antwort für {repo_name} ist kein gültiges JSON")
        return []

    if data.get("truncated"):
        log(f"⚠️  Tree für {repo_name} wurde von GitHub abgeschnitten (truncated) – evtl. fehlen Dateien")

    return data.get("tree", [])


def get_file_content(user, repo_name, path):
    url = f"https://api.github.com/repos/{user}/{repo_name}/contents/{path}"
    response = safe_get(url)

    if response is None:
        return ""

    if response.status_code != 200:
        log(f"⚠️  Konnte Datei {path} nicht laden (Status {response.status_code})")
        return ""

    try:
        data = response.json()
    except requests.exceptions.JSONDecodeError:
        log(f"❌ Datei‑Antwort für {path} ist kein gültiges JSON")
        return ""

    if "content" in data:
        return base64.b64decode(data["content"]).decode("utf-8", errors="ignore")

    return ""


HEADING_RE = re.compile(r"^#{1,6}(\s|$)")
TABLE_OR_RULE_RE = re.compile(r"^[|\-:\s]+$")
LIST_MARKER_RE = re.compile(r"^([-*+]|\d+\.)\s+")


def _strip_markdown(text: str) -> str:
    text = re.sub(r"!\[[^\]]*]\([^)]*\)", "", text)  # Bilder/Badges entfernen
    text = re.sub(r"\[([^\]]*)]\([^)]*\)", r"\1", text)  # Links -> Linktext
    text = re.sub(r"<[^>]+>", "", text)  # rohes HTML entfernen
    text = re.sub(r"`([^`]*)`", r"\1", text)  # Inline-Code
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)  # Fett
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)  # Kursiv
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _truncate(text: str, max_length: int) -> str:
    if len(text) <= max_length:
        return text
    truncated = text[:max_length].rsplit(" ", 1)[0]
    return truncated.rstrip(".,;:- ") + "…"


def _is_skippable_line(stripped: str) -> bool:
    # Badge/Bild-Zeilen, Tabellenzeilen und horizontale Linien enthalten
    # keinen Fließtext und sollen keinen Absatz beginnen/fortsetzen.
    if TABLE_OR_RULE_RE.match(stripped):
        return True
    if stripped.startswith("|") and stripped.endswith("|"):
        return True
    only_images = re.fullmatch(r"(\[!\[[^\]]*]\([^)]*\)]\([^)]*\)|!\[[^\]]*]\([^)]*\)|\s)+", stripped)
    return bool(only_images)


def _first_paragraph(lines):
    in_code_block = False
    current = []

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        if HEADING_RE.match(stripped):
            break
        if not stripped:
            if current:
                break  # Ende des ersten Absatzes
            continue  # führende Leerzeilen überspringen
        if _is_skippable_line(stripped):
            if current:
                break
            continue

        stripped = re.sub(r"^>\s?", "", stripped)  # Blockquote-Marker
        stripped = LIST_MARKER_RE.sub("", stripped)  # Listen-Marker
        current.append(stripped)

    if not current:
        return None

    text = _strip_markdown(" ".join(current))
    text = _truncate(text, MAX_DESCRIPTION_LENGTH)
    return text or None


def extract_title_and_paragraph(content: str):
    lines = content.splitlines()

    title = None
    title_idx = None

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("#"):
            candidate = _strip_markdown(stripped.lstrip("#").strip())
            if candidate:
                title = _truncate(candidate, MAX_TITLE_LENGTH)
                title_idx = idx
                break

    if title is None or title_idx is None:
        return None, None

    description = _first_paragraph(lines[title_idx + 1:])

    return title, description


def main():

    repos = get_repos(GITHUB_USER)

    log(f"Gefundene Repos: {len(repos)}")

    result = []

    for repo in repos:
        if not isinstance(repo, dict):
            log(f"❌ Unerwarteter Repo‑Eintrag (kein Objekt): {repo}")
            continue

        repo_name = repo.get("name")
        if not repo_name:
            log("❌ Repo ohne Namen übersprungen")
            continue

        if repo.get("fork"):
            log(f"⏭️  Repo übersprungen (Fork): {repo_name}")
            continue

        if repo.get("archived"):
            log(f"⏭️  Repo übersprungen (archiviert): {repo_name}")
            continue

        log(f"🔍 Analysiere Repo: {repo_name}")

        branch = repo.get("default_branch", "main")
        tree = get_repo_tree(GITHUB_USER, repo_name, branch)

        readme_entries = []
        for item in tree:
            if item.get("type") == "blob" and item.get("path", "").lower().endswith(".md"):
                path = item["path"]
                parts = path.split("/")
                basename = parts[-1].lower().removesuffix(".md")

                if basename in EXCLUDED_FILENAMES:
                    log(f"⏭️  Übersprungen (Meta-Datei): {path}")
                    continue

                log(f"📄 Datei gefunden: {path}")

                content = get_file_content(GITHUB_USER, repo_name, path)
                title, description = extract_title_and_paragraph(content)

                if title:
                    log(f"   ➜ Titel: {title}")
                else:
                    log("   ➜ Kein Titel gefunden")

                if description:
                    log(f"   ➜ Beschreibung: {description[:80]}...")
                else:
                    log("   ➜ Keine Beschreibung (Paragraph) gefunden")

                # Typ bestimmen
                in_subdir = len(parts) > 1
                in_docs = parts[0].lower() in {"docs", "doc", "documentation"}

                if basename == "readme" and not in_subdir:
                    filetype = "readme"
                elif basename == "readme" and in_subdir:
                    filetype = "module"
                elif in_docs:
                    filetype = "docs"
                elif any(kw in basename for kw in API_KEYWORDS):
                    filetype = "api"
                elif any(kw in basename for kw in GUIDE_KEYWORDS):
                    filetype = "guide"
                else:
                    filetype = "text"

                readme_entries.append({
                    "path": path,
                    "title": title or parts[-1].removesuffix(".md"),
                    "description": description or "",
                    "type": filetype
                })

        readme_entries.sort(key=lambda entry: entry["path"].lower())

        result.append({
            "name": repo_name,
            "description": repo.get("description"),
            "url": repo.get("html_url"),
            "pushed_at": repo.get("pushed_at"),
            "default_branch": branch,
            "readmes": readme_entries
        })

    result.sort(key=lambda repo: repo["name"].lower())

    with open("readme-data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    log("🎉 Fertig! Datei readme-data.json wurde erstellt.")


if __name__ == "__main__":
    main()
