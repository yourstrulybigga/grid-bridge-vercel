# Grid Bridge (Vercel-ready)
A minimal, cost-effective bridge that lets you talk to **Grid** (OpenAI) from inside **Notion**. Deploys to Vercel free tier.

## What it does
- Receives a POST with a Notion `page_id` and reads the page's properties (expects **User Question**).
- Sends the question to OpenAI using a persistent **Grid system prompt**.
- Writes the reply back to a Notion property called **Grid Reply**.
- Optional: Use a checkbox property **Ask Grid** to trigger via Make.com or Zapier.

## Quick Deploy (5–10 minutes)
1. **Create Notion Integration**
   - Notion → Settings & Members → Developers → New integration.
   - Copy the **Internal Integration Token**.
   - Share your **Ask Grid** database with this integration (Share → Invite → Select integration).

2. **Create the Notion Database**
   - In Notion, create a new database called **Ask Grid** (or import `ask_grid_template.csv` from this repo).
   - Required properties (exact names):
     - `Name` (Title)
     - `User Question` (Rich text / Text)
     - `Ask Grid` (Checkbox) – optional but recommended
     - `Grid Reply` (Rich text)
     - `Status` (Select: New, Replied)
   - Copy the database ID from the Notion URL if you plan to set `NOTION_CHAT_DATABASE_ID` (optional).

3. **Deploy to Vercel**
   - Create a free Vercel account.
   - Import this repo (zip upload or GitHub).
   - Add **Environment Variables** in Vercel Project Settings:
     - `OPENAI_API_KEY`
     - `NOTION_SECRET`
     - Optional: `NOTION_CHAT_DATABASE_ID`
     - Optional: `OPENAI_MODEL` (defaults to `gpt-5`)
   - Deploy.

4. **Test**
   - `GET https://<your-vercel-app>.vercel.app/api/ping` → should return `{ "ok": true }`.
   - `POST https://<your-vercel-app>.vercel.app/api/grid` with JSON body:
     ```json
     {
       "page_id": "YOUR_PAGE_ID",
       "question": "Override question (optional)",
       "grid_system_prompt": "Override Grid prompt (optional)",
       "model": "gpt-5"  // optional
     }
     ```
   - If `question` is omitted, the function will read from the page's **User Question** property.

## Automate from Notion (Make.com recommended)
- **Trigger**: Watch Database Items / Page Updated (Ask Grid DB), filter where **Ask Grid** is checked or **Status** is "New".
- **Action**: HTTP → POST to your `/api/grid` endpoint with `{ "page_id": <Notion Page ID> }`.
- **Result**: Function writes the answer to **Grid Reply** and sets Status → Replied.
- (You can uncheck Ask Grid via Make, too.)

## Endpoint Summary
- `GET /api/ping` → health check
- `POST /api/grid`
  - Body:
    - `page_id` (string) – required unless you supply `NOTION_CHAT_DATABASE_ID` and a `title` to search.
    - `question` (string) – optional; else read from **User Question** property.
    - `grid_system_prompt` (string) – optional; overrides the default below.
    - `model` (string) – optional; defaults to `OPENAI_MODEL` or `gpt-5`.
  - Response: `{ ok: true, reply: "...", page_id: "..." }`

## Default Grid System Prompt
This is embedded in the function. You can override by sending `grid_system_prompt` in the request body:

> You are **Grid**, a creative, witty, blunt, encouraging digital right-hand for an entrepreneur named YoursTru. Use a poetic, lyrical tone, tell it like it is — no sugarcoating. Do not invent facts. Keep responses concise and include step-by-step next actions when helpful. When asked to produce templates or code, provide copy-paste ready output. Sign off occasionally: ‘— Grid’.

## Notes
- The code only reads/writes properties you share with the integration.
- Use environment variables; never hard-code keys.
- Free Vercel + modest OpenAI usage keeps this very low-cost.

## License
MIT


---

## New: Weekly Recaps Endpoint

**Endpoint:** `POST /api/recap`

**What it does:** Reads a Notion "Standings / Recaps" database row and generates a hype two-paragraph recap using Grid.

**Expected Notion properties:**  
- `Name` (Title)  
- `Week` (Number or Text)  
- `Standings Summary` (Text)  
- `Biggest Upset` (Text)  
- `Eliminated` (Text/Number)  
- `Still Alive` (Text/Number)  
- `Notes` (Text, optional)  
- `Recap` (Rich text)  
- `Status` (Select: New, Replied, Error)

**Body (JSON):**
```json
{
  "page_id": "YOUR_PAGE_ID",
  "week": "optional override",
  "summary": "optional override",
  "biggest_upset": "optional override",
  "eliminated": "optional override",
  "alive": "optional override",
  "notes": "optional override",
  "model": "gpt-5",
  "system_prompt": "override the default recap style if desired"
}
```

**Response:**
```json
{ "ok": true, "page_id": "...", "recap": "..." }
```

**Automation (Make.com):**
- Trigger: Watch Database Items (Standings/Recaps DB) where `Status = New` or `Needs Recap = true`.
- Action: HTTP POST → `/api/recap` with `{ "page_id": <Notion Page ID> }`.
- Action: Update page → `Status = Replied` (the function already attempts to set it, but double-set is fine).
