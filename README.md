# CodeGauge

**CodeGauge** is a full-stack GitHub repository analyzer and side-by-side comparison dashboard built with React 19, Vite, Tailwind CSS v4, Express, and Recharts. It streams public GitHub repository tarballs over Server-Sent Events (SSE) to count total/code/blank/comment lines across 100+ programming languages (including APL via `.apl`, `.aplf`, `.apln`, `.dyalog`), evaluates Code Health & Cyclomatic Complexity with file-level refactoring recommendations, compares two repositories side-by-side, and exports multi-page PDF reports and social share cards.

---

## Key Features

### 1. Streaming Repository Analysis
- **Live SSE Progress**: Connects via `EventSource` to `/api/analyze` and streams real-time stages (`connecting`, `metadata`, `downloading`, `parsing`, `complete`) with byte progress, scanned file counts, and cumulative line counts.
- **Broad Input Support**: Accepts full GitHub URLs (`https://github.com/owner/repo`), branch URLs (`https://github.com/owner/repo/tree/branch`), or shorthand (`owner/repo`).
- **Binary & Oversized Safeguards**: Automatically skips binary extensions, detects null-byte buffers, enforces a `5 MB` per-file cap and `250 MB` archive cap, and aborts upstream fetches cleanly when the client disconnects.

### 2. Code Health & Cyclomatic Complexity Engine
The header **Code Health Gauge** (`0–100`) evaluates repository maintainability across three weighted pillars:
1. **Comment-to-Code Ratio (`0–35 pts`)**: Supports C-style (`//`, `/* */`), hash (`#`), SQL/Lua/Haskell (`--`), HTML (`<!-- -->`), and APL (`⍝`) comment syntax.
2. **File Size Distribution (`0–35 pts`)**: Scores median/average file footprint and flags oversized modules exceeding `50 KB`.
3. **Cyclomatic Complexity (`0–30 pts`)**: Performs static control-flow branch analysis (`if`, `else if`, `elif`, `case`, `catch`, `for`, `while`, `match`, `&&`, `||`, `??`, ternary operators, APL guards/branch arrows), tracks maximum nesting depth (brace-based and indentation-based), and counts routine declarations.

#### High-Complexity File Refactoring Recommendations
In the **Cyclomatic Complexity & Refactoring Recommendations** dashboard section (`#complexity`), CodeGauge displays:
- **Repository Complexity Score (`0–100`)**, **Average Complexity (`M`)**, **Peak File Complexity**, and **Refactoring Targets** count.
- **Filterable Hotspot List** (`All Flagged`, `Critical & High`, `Deep Nesting`, `Large Modules`) flagging complex modules (`M >= 15` or deep nesting) with tailored structural recommendations:
  - *Extract Helper Functions* (high branch-to-function density)
  - *Flatten Deep Nesting* (guard clauses & early returns for `depth >= 4`)
  - *Simplify Branching Logic* (lookup maps / strategy dispatch for `M >= 22`)
  - *Split Monolithic Module* (modules `>= 350` code lines or `>= 40 KB`)
  - *Document Complex Branches* (low inline comment density on complex control flows)

### 3. Language Breakdown & Historical Growth
- **Interactive Stacked Bar, Bar Chart, Donut Chart & Table**: Filter the File Explorer directly by clicking any language segment, bar, or table row.
- **Top 5 Languages Growth Chart**: Queries the repository commit closest to 30 days prior and compares **1 Month Ago** vs. **Current** code lines or percentage share via a grouped Recharts bar chart and delta strip (skipped cleanly with zero extra download if no newer commits occurred).

### 4. Side-by-Side Repository Comparison
Enable **Compare Mode** to analyze two repositories simultaneously:
- **KPI & Metadata Diff Table**: Side-by-side comparison of Code Health, lines of code, languages, file counts, open PRs, and last updated timestamps.
- **Grouped Language Comparison Bar Chart**: Compares non-blank code lines and share percentages across shared languages.
- **5-Axis Code Health Radar Chart**: Toggle seamlessly between **Percentage (%)** normalized scores (`0–100%`) and **Raw Line Counts** (`Total Lines`, `Code Lines`, `Primary Language`, `Comment Lines`, `Blank Lines`).
- **File Size & Complexity Heatmap**: Pairs top files across both repositories under **All Metrics**, **Size (Bytes)**, or **Complexity (Lines)** modes, highlighting thermal hotspots (`≥1.5×` larger in bytes or more complex in lines) with explicit ratio badges.

### 5. File Explorer & Search
- Instant client-side search scoped to **Filename** or **Full Path** with highlighted matching substrings.
- Filter by language, file extension, size presets (`Tiny < 1 KB`, `Small 1–10 KB`, `Medium 10–100 KB`, `Large > 100 KB`), custom `Min KB` / `Max KB` bounds, and 5 sorting modes.
- Paginated table displaying up to `15,000` files (`50` per page).

### 6. Commit Activity & 4-Week Trend
- Displays **Last Updated** relative timestamp, **Open Pull Requests**, and **Commit Frequency** (commits/week and trailing 30-day volume from up to 100 sampled commits).
- **Recharts Weekly Activity Trend** line chart charting commit velocity across the last 4 weeks alongside an 8-week distribution summary.

### 7. Bilingual UI (EN / AR), PDF Export, Social Share & PWA
- **Bilingual Support**: Full **English (`LTR`)** and **Arabic (`RTL`)** localization with persisted preference (`localStorage`).
- **PDF Report Export**: Multi-page formatted PDF export powered by `jsPDF` and `html2canvas-pro`, including an optional **Detailed Breakdown (Top 10 Largest Files by Lines of Code)** toggle.
- **Social Media Sharing**: Generates a downloadable/copyable `1200×630` PNG summary card, permalink query parameters (`?repo=...&compare=...`) that auto-load on visit, and share links for X/Twitter, LinkedIn, and Facebook.
- **Progressive Web App (PWA)**: Installable web app with offline fallback indicator and cached UI/last report via `vite-plugin-pwa` + Workbox.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React |
| **Visualizations** | Recharts 3 (BarChart, LineChart, RadarChart) + Custom SVG Donut & Health Gauge |
| **Backend / API** | Express 4, Node.js `22.x`, `zlib` + `tar-stream` streaming decompression |
| **Export & PWA** | `jsPDF`, `html2canvas-pro`, HTML5 Canvas (`1200×630` PNG cards), `vite-plugin-pwa` |
| **Deployment** | Vercel Serverless Functions (`api/index.ts`, `vercel.json`) or standalone Node server (`server.ts`) |

---

## Project Structure

```text
├── api/
│   └── index.ts                 # Vercel serverless handler (maxDuration: 60s)
├── public/                      # PWA icons & static assets
├── src/
│   ├── components/
│   │   ├── ActivityHistory.tsx  # Commit frequency, open PRs & 4-week Recharts trend
│   │   ├── CodeHealthGauge.tsx  # Header semicircular health gauge & 3-pillar popover
│   │   ├── ComplexityInsights.tsx # Cyclomatic complexity metrics & refactoring advice
│   │   ├── FileExplorer.tsx     # Filename/path search, filters, sorting & pagination
│   │   ├── Header.tsx           # Navigation bar, health gauge, share menu & EN/AR switch
│   │   ├── LanguageBreakdown.tsx # Stacked bar, Recharts bar & growth chart, donut & table
│   │   ├── OfflineIndicator.tsx # Offline mode notification banner
│   │   ├── PdfReportSheet.tsx   # Printable off-screen multi-page PDF layout
│   │   ├── ProgressPanel.tsx    # Live SSE download & parsing progress bar
│   │   ├── PWAInstallButton.tsx # Install prompt / iOS install guide modal
│   │   ├── RepoComparison.tsx   # Side-by-side metrics, radar chart & size/complexity heatmap
│   │   ├── RepoSearchBar.tsx    # Single & compare repository input form
│   │   └── SocialShareMenu.tsx  # Shareable URL, PNG summary card & social platform links
│   ├── hooks/
│   │   └── usePWA.ts            # Service worker registration & install prompt state
│   ├── lib/
│   │   ├── exportPdf.ts         # jsPDF + html2canvas-pro pagination exporter
│   │   ├── generateShareCard.ts # Off-screen 1200x630 PNG summary card renderer
│   │   ├── health.ts            # Code Health & Cyclomatic Complexity fallback resolution
│   │   ├── i18n.ts              # Complete EN (LTR) / AR (RTL) translation dictionary
│   │   ├── languageMap.ts       # 100+ extension-to-language & binary definitions
│   │   └── types.ts             # Shared TypeScript interfaces for API & UI
│   ├── server/
│   │   └── apiApp.ts            # Express API app, tarball parser, complexity & GitHub clients
│   ├── App.tsx                  # Main application state, SSE streams & URL sharing sync
│   ├── index.css                # Tailwind CSS v4 entry
│   └── main.tsx                 # React root & font imports
├── .env.example                 # Environment variable template
├── index.html                   # App shell & OpenGraph metadata
├── package.json                 # Dependencies & scripts
├── server.ts                    # Local dev (Vite middleware) & Node production server
├── vercel.json                  # Vercel build, rewrites & PWA/SSE cache headers
└── vite.config.ts               # Vite, Tailwind CSS v4 & VitePWA configuration
```

---

## Local Development

### Prerequisites
- **Node.js `22.x`**
- **npm** (or bun/pnpm compatible with `package.json`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional)
Copy `.env.example` to `.env` if you want to provide a GitHub Personal Access Token for higher GitHub REST API rate limits (`5,000 req/hr` instead of `60 req/hr` unauthenticated):

```bash
cp .env.example .env
```

```env
# Optional personal access token for higher GitHub API rate limits (metadata, PRs, commit history)
GITHUB_TOKEN="ghp_your_token_here"
```

### 3. Start the Development Server
Starts Express + Vite middleware on **port `3000`**:
```bash
npm run dev
```
Open `http://localhost:3000`.

### 4. Type-Check & Build
```bash
npm run lint     # Runs tsc --noEmit
npm run build    # Builds Vite frontend & PWA service worker into dist/
npm start        # Serves production build with Express on port 3000
```

---

## Deploying to Vercel

This repository is pre-configured for zero-config deployment on Vercel:

- `vercel.json` builds with `npm run build`, outputs `dist/`, routes `/api/*` to `api/index.ts` (`maxDuration: 60` seconds), and configures `Cache-Control: no-cache, no-transform` for SSE streams as well as proper headers for `/sw.js` and `/manifest.webmanifest`.
- `api/index.ts` exports the Express `createApiApp()` instance directly as a Vercel Serverless Function.

### Steps to Deploy
1. Push your repository to GitHub, GitLab, or Bitbucket (or run `vercel` from the CLI).
2. Import the project in the Vercel dashboard (Framework Preset: **Vite**).
3. *(Recommended)* Add `GITHUB_TOKEN` in **Project Settings → Environment Variables** to raise GitHub REST API rate limits for repository metadata, open PR counts, commit activity, and 1-month-ago snapshot lookups.
4. Deploy.

---

## API Reference

### `GET /api/health`
Returns server liveness status:
```json
{ "status": "ok" }
```

### `GET /api/analyze?url=<repo>`
Streams **Server-Sent Events (`text/event-stream`)** for any public GitHub repository (`https://github.com/owner/repo` or `owner/repo`).

#### Stream Event Types
1. **`progress`**
   ```json
   {
     "type": "progress",
     "stage": "downloading",
     "progress": 64,
     "bytesDownloaded": 1245184,
     "totalBytes": 2048000,
     "filesProcessed": 142,
     "linesCounted": 18420,
     "currentFile": "src/index.ts"
   }
   ```
2. **`complete`** — Returns the full `AnalysisResult` payload including `repository`, `summary` (with `health`, `complexity`, and `recommendations`), `languages`, `files`, and `languageHistory`.
3. **`error`** — Structured error codes: `INVALID_URL`, `NOT_FOUND`, `RATE_LIMIT`, `ARCHIVE_TOO_LARGE`, or `FETCH_FAILED`.
