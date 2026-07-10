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
├── frontend/                  # Unified Next.js application
│   ├── src/app/
│   │   ├── api/               # Next.js Serverless API Routes
│   │   │   ├── health/route.ts   # GET /api/health
│   │   │   ├── import/route.ts   # POST /api/import
│   │   │   └── login/route.ts    # POST /api/login
│   │   ├── page.tsx           # Full 4-step wizard UI
│   │   ├── layout.tsx         # Root layout + fonts
│   │   └── globals.css        # Tailwind v4 theme tokens
│   ├── src/services/
│   │   ├── geminiService.ts   # Gemini AI matching, rotation & failover
│   │   └── supabaseService.ts # Supabase database integration
│   ├── src/utils/
│   │   └── validation.ts      # Data validation & enum clamping rules
│   └── package.json
├── backend/                   # Legacy Express API server (backup)
├── supabase/schema.sql        # DB schema — run in Supabase SQL Editor
├── sample_csvs/               # Test CSV files
└── package.json               # Workspace root
```

---

## ⚙️ Setup & Running Locally

### Prerequisites
- Node.js v18+ and npm
- A Supabase project
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) *(optional — rotates up to 3 keys, falls back to heuristic if empty)*

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create a `.env.local` file inside the `frontend` folder:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEYS=key1,key2,key3
```

### 3. Set Up Supabase Database
1. Go to your [Supabase project](https://supabase.com/dashboard) → **SQL Editor**
2. Run the SQL statements from `supabase/schema.sql`.

### 4. Run Development Server

```bash
npm run dev
```

This starts the application locally at `http://localhost:3000` (handling both pages and API routes).

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

This project can be run inside a standalone Docker container. A multi-stage build is configured to optimize image size.

### Prerequisites
- Docker installed on your host system.

### Running the Container
1. Ensure your environment variables are configured in `frontend/.env.local`.
2. Build the image from root directory:
   ```bash
   docker build -t databridge-ai .
   ```
3. Run the container (injecting your env variables):
   ```bash
   docker run -p 3000:3000 --env-file frontend/.env.local databridge-ai
   ```
4. Access the full app (including API endpoints) at `http://localhost:3000`.

---

## 📦 Deployment

### Frontend & API (Unified) → Vercel
1. Set **Root Directory** as `frontend` in your Vercel project configuration page.
2. In Vercel **Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GEMINI_API_KEYS`
3. Vercel will automatically build and serve the entire application as a single project!

---

*Built for GrowEasy Software Developer Intern Assignment — July 2026*
