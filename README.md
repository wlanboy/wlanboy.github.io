# wlanboy.github.io

Private homepage hosted by GitHub Pages — a portfolio explorer that automatically aggregates all public GitHub repositories and presents them in an interactive interface.

## Link

- https://wlanboy.github.io

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Main project explorer with search, filtering, and inline README viewer |
| `fokus/index.html` | Topic Constellation Map — alternative topic visualization |
| `terminal.html` | Homelab terminal simulator (easter egg: try `cowsay`) |

## Architecture

This is a static site with automated data generation — no Jekyll or Hugo involved.

```txt
GitHub API
    │
    ▼
generate.py  (Python, runs via GitHub Actions daily)
    │
    ▼
readme-data.json  (committed to repo)
    │
    ▼
index.html + script.js  (served via GitHub Pages)
```

- **Data generation**: `generate.py` fetches all public repositories updated in the last 300 days, extracts README titles and descriptions, and writes `readme-data.json`.
- **Automation**: `.github/workflows/generate-md-data.yml` runs the generator daily at 12:00 UTC and commits any changes automatically.
- **Frontend**: Vanilla HTML/CSS/JavaScript — no framework dependencies.
- **Deployment**: GitHub Pages (static files only) or Kubernetes via the included Helm chart.

## Run locally

```bash
python3 -m http.server 8000
```

## Generate data for webpage

```bash
uv lock --upgrade
uv sync
uv run pyright
uv run ruff check
uv run generate.py
```

For higher GitHub API rate limits, set a `GITHUB_TOKEN` environment variable before running.

## Kubernetes deployment

A Helm chart is provided in [website-chart/](website-chart/) for self-hosted deployment.

Features:

- Init container pulls this repository at startup
- TLS support via cert-manager (`values.yaml`)
- Istio Gateway + VirtualService integration
- Simplified no-SSL variant (`values-simple.yaml`)
