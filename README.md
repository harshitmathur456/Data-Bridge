# DataBridge AI — AI-Powered CSV Importer

**GrowEasy Software Developer (Intern) Assignment Submission**

An intelligent, guided CSV import wizard that maps *any* CSV layout — regardless of column names or structure — into a fixed CRM schema using Google Gemini AI. Built with Next.js, Express, TypeScript, and Supabase.

---

## 🚀 Live Demo

**App:** [deploy link here after Vercel deployment]
**GitHub:** [repo link here]

---

## ✨ Features

- **Guided Import Flow** — Upload → Preview → AI Mapping → Results, with a persistent stepper so the user always knows where they are
- **Drag & Drop Upload** — client-side CSV validation via PapaParse, no AI call until the user confirms
- **AI Field Mapping** — Gemini 1.5 Flash maps arbitrary headers (`Ph No`, `Contact Number`, `E-mail Address`, etc.) to the fixed CRM schema by meaning, not by column name
- **Heuristic Fallback** — works even without an API key, using local pattern matching, so the app never fully breaks
- **Batch Processing with Retry** — rows sent to Gemini in configurable chunks (15/batch); failed batches retry automatically before being reported
- **Real-time Progress Indicator** — live progress bar + per-batch status while AI processing runs, so the user is never staring at a blank screen
- **Robust Data Validation:**
  - Skips a row only if it has **neither** email **nor** phone
  - `crm_status` / `data_source` are strictly clamped to the allowed enum values — never a free-text guess
  - Multiple emails/phones in one field → first one becomes the primary value, the rest go into `crm_note`
  - Country code and local number are split into separate fields, across `+91`, `0091-`, no-separator, and parenthesis-style formats
  - Placeholder junk (`N/A`, `NA`, `-`) is treated as missing, not real data
  - **CSV-injection payloads neutralized** — values starting with `=`, `+`, `-` are escaped before storage
- **Supabase Persistence** — every import session, successful record, and skipped row is saved to Postgres
- **Simple Access Gate** — lightweight name + CAPTCHA login so the app isn't wide open
- **Clean Results UI** — bento-style metric cards, tabbed Imported/Skipped views, pagination, sync-status badges
- **Responsive Design** — mobile-friendly with bottom-nav fallback, dark mode supported

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript (Next.js API routes handle production) |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`), with key rotation + heuristic fallback |
| CSV Parsing | PapaParse (client-side) |
| Database | Supabase (PostgreSQL) |
| Icons | Lucide React |
| Fonts | Bricolage Grotesque (headings), Inter (body) |

---

## 📂 Project Structure

```
groweasy-csv-importer/
├── frontend/                    # Unified Next.js application
│   ├── src/app/
│   │   ├── api/
│   │   │   ├── health/route.ts     # GET /api/health
│   │   │   ├── import/route.ts     # POST /api/import
│   │   │   └── login/route.ts      # POST /api/login
│   │   ├── page.tsx             # Full import wizard UI
│   │   ├── layout.tsx           # Root layout + fonts
│   │   └── globals.css          # Tailwind v4 theme tokens
│   ├── src/services/
│   │   ├── geminiService.ts     # Gemini AI matching, key rotation & failover
│   │   └── supabaseService.ts   # Supabase database integration
│   ├── src/utils/
│   │   └── validation.ts        # Data validation & enum clamping rules
│   └── package.json
├── backend/                     # Legacy Express API server (backup)
├── supabase/schema.sql          # DB schema — run in Supabase SQL Editor
├── sample_csvs/                 # 7 test CSV files (see Testing section)
└── package.json                 # Workspace root
```

---

## ⚙️ Setup & Running Locally

### Prerequisites
- Node.js v18+ and npm
- A Supabase project
- A Gemini API key from Google AI Studio (optional — rotates up to 3 keys, falls back to heuristic matching if empty)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create a `.env.local` file inside the `frontend` folder:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEYS=key1,key2,key3
```

### 3. Set Up Supabase Database
1. Go to your Supabase project → SQL Editor
2. Run the SQL statements from `supabase/schema.sql`

### 4. Run Development Server
```bash
npm run dev
```
Starts the app locally at `http://localhost:3000` (pages + API routes together).

---

## 🐳 Docker Setup

 A multi-stage Dockerfile is included for a lightweight, production-ready container.

### Prerequisites
- Docker installed on your host system

### Running the Container
1. Make sure your environment variables are set in `frontend/.env.local`
2. Build the image from the project root:
   ```bash
   docker build -t databridge-ai .
   ```
3. Run the container, injecting your env variables:
   ```bash
   docker run -p 3000:3000 --env-file frontend/.env.local databridge-ai
   ```
4. Access the full app (including API endpoints) at `http://localhost:3000`

---

## 📦 Deployment

**Frontend & API (Unified) → Vercel**
1. Set **Root Directory** to `frontend` in your Vercel project settings
2. Add these Environment Variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GEMINI_API_KEYS`
3. Vercel builds and serves the entire application as a single project

---

## 🧪 Running Unit Tests
```bash
cd backend
npm test
```
Tests cover:
- ✅ Standard valid record mapping
- ✅ Multiple email extraction (extras appended to `crm_note`)
- ✅ Multiple phone numbers + country code splitting
- ✅ Skip validation (rows with no email **and** no phone)
- ✅ Enum clamping for invalid `crm_status` / `data_source`

---

## 📋 CRM Schema (Target)

| Field | Type | Notes |
|---|---|---|
| `created_at` | string | Formatted as `YYYY-MM-DD HH:mm:ss`, parseable by `new Date()` |
| `name` | string | Full name |
| `email` | string | Primary email, trimmed + lowercased |
| `country_code` | string | e.g. `+91` |
| `mobile_without_country_code` | string | Digits only, no country code, no formatting characters |
| `company` | string | |
| `city`, `state`, `country` | string | |
| `lead_owner` | string | Assigned team member — never confused with the lead's own contact info |
| `crm_status` | enum | `GOOD_LEAD_FOLLOW_UP` \| `DID_NOT_CONNECT` \| `BAD_LEAD` \| `SALE_DONE` |
| `data_source` | enum | `leads_on_demand` \| `meridian_tower` \| `eden_park` \| `varah_swamy` \| `sarjapur_plots` |
| `crm_note` | string | Notes + any extra emails/phones appended here |
| `possession_time` | string | |
| `description` | string | |

**Validation rules:**
- A record must have `email` **or** `mobile_without_country_code` — otherwise it's skipped
- `crm_status` and `data_source` are clamped to the allowed enum list — left blank if there's no confident match, never a free-text guess
- Extra emails/phones beyond the first are appended into `crm_note`
- Placeholder junk values (`N/A`, `NA`, `-`, `none`) are treated as missing data
- Values that look like spreadsheet formulas (`=`, `+`, `-` prefix) are escaped before storage to prevent CSV-injection

---

## 🎯 Testing with Sample CSVs

The AI extraction pipeline was validated against **7 sample CSVs** covering everything from clean data to adversarial edge cases. All files are in `sample_csvs/`.

| File | What it tests |
|---|---|
| `standard_leads.csv` | Baseline case — CRM-schema-matching headers, clean data, all 4 `crm_status` values, all 5 `data_source` values |
| `messy_ad_leads.csv` | Realistic ad-export format — different column names (`Registration Date`, `E-mail Address`, `Status Code`), multiple emails/phones per cell |
| `invalid_leads.csv` | Core skip-logic test — rows with only email, only phone, and neither, confirming a record is skipped only when both are missing |
| `test_leads_messy.csv` | Mixed date formats, multiple emails/phones per row, a malformed phone number, and a row with no contact info at all |
| `test_leads_country_codes.csv` | International phone formats — `+91`, `0091-`, no separator, parentheses (US-style) — confirms `country_code` and `mobile_without_country_code` split correctly |
| `test_leads_tough.csv` | Adversarial structural cases — blank rows, junk header-like rows, multiline quoted fields, contradictory notes, Unicode names, HTML in notes, an invalid date, and lead-owner info that could be mistaken for lead contact info |
| `test_leads_advanced.csv` | Security & hygiene edge cases — a CSV-injection payload, literal `"N/A"` values, whitespace/case inconsistencies, phone extensions, emoji, currency symbols, lowercase status text, malformed row structure, and duplicate leads |

**Key things this test suite confirms:**
- Column names never need to match the CRM schema — mapping works by meaning
- Skip logic is precise: only rows missing both email and phone are skipped
- `crm_status` / `data_source` are never set to anything outside the allowed enums
- CSV-injection attempts are neutralized before storage
- Malformed CSV structure (extra/missing columns, blank rows) never crashes the import

---

## 🗄️ Supabase Tables

| Table | Description |
|---|---|
| `import_sessions` | One row per import run (file name, row counts, AI engine used) |
| `crm_records` | All successfully imported CRM records, linked to their session |
| `skipped_rows` | Raw rows that failed validation, with the skip reason |
| `user_logins` | Lightweight name + CAPTCHA entries for the app's access gate |

---

## ✅ Bonus Points Implemented

- [x] Drag & Drop upload
- [x] Progress indicators during AI processing
- [x] Retry mechanism for failed AI batches
- [x] Dark mode
- [x] Unit tests
- [x] Docker setup
- [x] Deployment (Vercel)
- [x] Well-written README with setup instructions
- [x] Extensive edge-case & security testing (7 sample CSVs, CSV-injection safety)
