# DataBridge AI — AI-Powered CSV Importer

> **GrowEasy Software Developer (Intern) Assignment Submission**

An intelligent, 3-step CSV import wizard that maps arbitrary CSV layouts to a fixed CRM schema using Google Gemini AI. Built with Next.js, Express, TypeScript, and Supabase.

---

## 🚀 Live Demo

> Deploy link will be available here after Vercel deployment.

---

## ✨ Features

- **3-Step Guided Import** — Upload → Preview → AI Mapping → Results
- **Drag & Drop Upload** — Client-side CSV validation via PapaParse
- **AI Field Mapping** — Gemini 1.5 Flash maps arbitrary headers to a fixed CRM schema
- **Heuristic Fallback** — Works without an API key using intelligent local pattern matching
- **Batch Processing** — Rows sent in configurable chunks (15/batch) with per-batch retry
- **Real-time Progress** — Live console log of each batch with progress bar
- **Data Validation** — Skips rows missing both email AND phone; enum clamping for `crm_status` / `data_source`
- **Supabase Persistence** — Each import session + all records saved to Supabase DB
- **Clean Results UI** — Bento metric cards, tabbed imported/skipped views, pagination, `✓ Synced` badges
- **Responsive Design** — Mobile-friendly with bottom nav fallback

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| CSV Parsing | PapaParse (client-side) |
| Database | Supabase (PostgreSQL) |
| Icons | Lucide React |
| Fonts | Bricolage Grotesque (headings), Inter (body) |

---

## 📂 Project Structure

```
groweasy-csv-importer/
├── backend/                   # Express API server
│   ├── src/
│   │   ├── server.ts          # Express entry point
│   │   ├── routes/import.ts   # POST /api/import
│   │   ├── services/
│   │   │   ├── geminiService.ts    # Gemini AI mapping + heuristic fallback
│   │   │   └── supabaseService.ts  # Supabase persistence
│   │   └── utils/validation.ts     # Schema validation & enum clamping
│   ├── tests/validation.test.ts    # Unit tests
│   └── .env.example
├── frontend/                  # Next.js app
│   └── src/app/
│       ├── page.tsx           # Full 4-step wizard UI
│       ├── layout.tsx         # Root layout + fonts
│       └── globals.css        # Tailwind v4 theme tokens
├── supabase/schema.sql        # DB schema — run in Supabase SQL Editor
├── sample_csvs/               # Test files
│   ├── standard_leads.csv
│   ├── messy_ad_leads.csv     # Different column names, extra emails/phones
│   └── invalid_leads.csv      # Tests skip logic
└── package.json               # Root workspace orchestrator
```

---

## ⚙️ Setup & Running Locally

### Prerequisites
- Node.js v18+ and npm
- A Supabase project (free tier works)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) *(optional — app works without one in mock mode)*

### 1. Clone & Install

```bash
git clone https://github.com/harshitmathur456/Data-Bridge.git
cd Data-Bridge
npm install          # installs root deps (concurrently)
npm run install:all  # installs backend + frontend deps
```

### 2. Configure Backend Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here   # optional
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set Up Supabase Database

1. Go to your [Supabase project](https://supabase.com/dashboard) → **SQL Editor**
2. Paste and run the contents of `supabase/schema.sql`
3. This creates: `import_sessions`, `crm_records`, and `skipped_rows` tables

### 4. Run Development Servers

```bash
npm run dev
```

This starts:
- **Backend** → `http://localhost:3001`
- **Frontend** → `http://localhost:3000`

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests cover:
- ✅ Standard valid record mapping
- ✅ Multiple email extraction (extras go to `crm_note`)
- ✅ Multiple phone numbers + country code splitting
- ✅ Skip validation (rows with no email AND no phone)
- ✅ Enum clamping for invalid `crm_status` / `data_source`

---

## 📋 CRM Schema (Target)

| Field | Type | Notes |
|---|---|---|
| `created_at` | string | Formatted as `YYYY-MM-DD HH:mm:ss` |
| `name` | string | Full name |
| `email` | string | Primary email |
| `country_code` | string | e.g. `+91` |
| `mobile_without_country_code` | string | Digits only |
| `company` | string | |
| `city`, `state`, `country` | string | |
| `lead_owner` | string | |
| `crm_status` | enum | `GOOD_LEAD_FOLLOW_UP` \| `DID_NOT_CONNECT` \| `BAD_LEAD` \| `SALE_DONE` |
| `data_source` | enum | `leads_on_demand` \| `meridian_tower` \| `eden_park` \| `varah_swamy` \| `sarjapur_plots` |
| `crm_note` | string | Notes + extra emails/phones appended here |
| `possession_time` | string | |
| `description` | string | |

**Validation Rules:**
- Record must have `email` **OR** `mobile_without_country_code` — else it is **skipped**
- `crm_status` and `data_source` are clamped to allowed enums (blank if unrecognized)
- Extra emails/phones are appended to `crm_note`

---

## 🎯 Testing with Sample CSVs

Three sample files are in `sample_csvs/`:

| File | Purpose |
|---|---|
| `standard_leads.csv` | Clean headers matching CRM schema |
| `messy_ad_leads.csv` | Different headers, extra emails/phones, messy formats |
| `invalid_leads.csv` | Mix of valid + missing-contact rows (tests skip logic) |

---

## 🗄️ Supabase Tables

| Table | Description |
|---|---|
| `import_sessions` | One row per import run (file name, counts, AI engine used) |
| `crm_records` | All successfully imported CRM records, linked to session |
| `skipped_rows` | Raw rows that failed validation + skip reason |

---

## 🐳 Docker Setup

This project can be run inside Docker containers using Docker Compose. A multi-stage build is configured to optimize image size.

### Prerequisites
- Docker and Docker Compose installed on your host system.

### Running with Docker Compose
1. Ensure your backend environment variables are configured in `backend/.env` (refer to `backend/.env.example`).
2. Run the following command from the project root:
   ```bash
   docker-compose up --build
   ```
3. This will build both the frontend and backend images and run them:
   - **Frontend** → `http://localhost:3000`
   - **Backend** → `http://localhost:3001`

### Running Standalone Frontend Container
If you wish to build and run only the Next.js frontend container:
1. Build the image:
   ```bash
   docker build -t databridge-ai .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 databridge-ai
   ```

---

## 📦 Deployment

- **Frontend** → Vercel (`npm run build` in `/frontend`)
- **Backend** → Render or Railway (set env vars in dashboard)

---

*Built for GrowEasy Software Developer Intern Assignment — July 2026*
