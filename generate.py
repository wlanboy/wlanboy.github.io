import os
import requests
import base64
import json
from datetime import datetime, timedelta, timezone

GITHUB_USER = "wlanboy"
TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Authorization": f"token {TOKEN}"} if TOKEN else {}

DAYS = 300
CUTOFF_DATE = datetime.now(timezone.utc) - timedelta(days=DAYS)

EXCLUDED_FILENAMES = {
    "changelog", "contributing", "license", "code_of_conduct",
    "security", "authors", "maintainers", "codeowners",
    "pull_request_template", "issue_template", "funding",
}

API_KEYWORDS = {"api", "api-reference", "openapi", "swagger"}
GUIDE_KEYWORDS = {"guide", "tutorial", "howto", "how-to", "getting-started"}


def log(msg):
    print(f"[INFO] {msg}")


def get_repos(user):
    url = f"https://api.github.com/users/{user}/repos?per_page=120&type=public"
    response = requests.get(url, headers=HEADERS)

    log(f"GitHub API Status: {response.status_code}")

    try:
        data = response.json()
    except Exception:
        log("❌ API‑Antwort ist kein gültiges JSON")
        return []

    if isinstance(data, dict) and "message" in data:
        log(f"❌ GitHub API Fehler: {data['message']}")
        return []

    if not isinstance(data, list):
        log("❌ Unerwartetes API‑Format (keine Liste)")
        return []

    return data


def repo_recently_updated(repo):
    pushed_at = repo.get("pushed_at")
    if not pushed_at:
        return False

    pushed_date = datetime.strptime(
        pushed_at, "%Y-%m-%dT%H:%M:%SZ"
    ).replace(tzinfo=timezone.utc)
    return pushed_date >= CUTOFF_DATE


def get_repo_tree(user, repo_name, branch):
    url = f"https://api.github.com/repos/{user}/{repo_name}/git/trees/{branch}?recursive=1"
    response = requests.get(url, headers=HEADERS)

    if response.status_code != 200:
        log(f"⚠️  Konnte Tree für {repo_name} nicht laden (Status {response.status_code})")
        return []

    data = response.json()
    return data.get("tree", [])


def get_file_content(user, repo_name, path):
    url = f"https://api.github.com/repos/{user}/{repo_name}/contents/{path}"
    response = requests.get(url, headers=HEADERS).json()

    if "content" in response:
        return base64.b64decode(response["content"]).decode("utf-8", errors="ignore")

    return ""


def extract_title_and_paragraph(content: str):
    """
    Liefert (title, description):
    - title: erster Markdown-Heading (#, ##, ### …)
    - description: erster nicht-leerer Paragraph nach diesem Heading
    """
    lines = content.splitlines()

    title = None
    title_idx = None

    # 1. ersten Heading finden
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("#"):
            candidate = stripped.lstrip("#").strip()
            if candidate:
                title = candidate
                title_idx = idx
                break

    if title is None or title_idx is None:
        return None, None

    # 2. ab der Zeile nach dem Heading den ersten nicht-leeren Paragraphen suchen
    paragraph_lines = []
    in_paragraph = False

    in_code_block = False

    for line in lines[title_idx + 1:]:
        stripped = line.strip()

        # Codeblöcke überspringen
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            if in_paragraph:
                break
            continue

        if in_code_block:
            continue

        # Absatztrenner: komplett leere Zeile
        if stripped == "":
            if in_paragraph:
                break
            else:
                continue

        # Headings überspringen
        if stripped.startswith("#"):
            if in_paragraph:
                break
            continue

        # Start eines Paragraphen
        if not in_paragraph:
            in_paragraph = True

        paragraph_lines.append(line)

    description = None
    if paragraph_lines:
        # Mehrere Zeilen zu einem Paragraphen zusammenführen und trimmen
        description = " ".join(line.strip() for line in paragraph_lines).strip()

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

        if not repo_recently_updated(repo):
            log(f"⏭️  Repo übersprungen (nicht aktualisiert in {DAYS} Tagen): {repo_name}")
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

        result.append({
            "name": repo_name,
            "description": repo.get("description"),
            "url": repo.get("html_url"),
            "pushed_at": repo.get("pushed_at"),
            "default_branch": branch,
            "readmes": readme_entries
        })

    with open("readme-data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    log("🎉 Fertig! Datei readme-data.json wurde erstellt.")


if __name__ == "__main__":
    main()
