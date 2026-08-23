# IEEE SB Finance Tracker — Setup Guide

A real hosted web app: Next.js frontend + Supabase (Postgres database, auth,
and permissions). Both Vercel and Supabase are free for this scale of use —
you are not paying anything to run this.

Total time if you follow in order: ~30-40 minutes, one time.

---

## What "secure" actually means here

Every permission rule (who can create a fest, who can delete someone else's
entry, who can manage accounts) lives in `supabase/schema.sql` as **Row Level
Security (RLS) policies**, enforced by the database itself — not by
JavaScript in the browser. Even someone who opens dev tools and edits
requests directly cannot do anything the database policy doesn't allow,
because Postgres checks every single query against these rules server-side.
The three roles (Master / Admin / User) are real, not cosmetic.

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com → Sign up / log in (free) → **New Project**.
2. Pick a name (e.g. `ieee-sb-finance`), set a strong database password
   (save it somewhere), pick the region closest to you, click **Create**.
3. Wait ~2 minutes for it to provision.

## Step 2 — Run the database schema

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project, copy the whole file, paste
   it in, and click **Run**.
3. You should see "Success. No rows returned." If you see an error, read it
   carefully — it usually means the script was only partially pasted.

## Step 3 — Get your API keys

1. In Supabase: **Project Settings** (gear icon) → **API**.
2. You'll need three values for the next step:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`
     — treat this one like a master password. Never share it, never put it
     in a public repo, never prefix it with `NEXT_PUBLIC_`.

## Step 4 — Create the first Master account

This is the one manual step, because the app itself has no public signup —
accounts only get created by Master/Admin from inside the app.

1. In Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
   Enter your email and a password. Check "Auto Confirm User." Click Create.
2. Copy the **User UID** shown for the account you just created.
3. Go to **SQL Editor** → **New query**, paste this (replace both values),
   and run it:
   ```sql
   insert into profiles (id, full_name, role)
   values ('PASTE-THE-USER-UID-HERE', 'Your Name', 'master');
   ```
4. That's your Master login. Every other account (Admins, Users) gets
   created from the Master screen inside the app from now on — no more SQL
   needed.

## Step 5 — Run it locally to check everything works (optional but recommended)

1. Install [Node.js](https://nodejs.org) if you don't have it (v20.9 or newer —
   check with `node --version` in a terminal; if you're on an older version,
   download the current LTS installer from nodejs.org).
2. In this project folder:
   ```
   npm install
   cp .env.local.example .env.local
   ```
3. Fill in the three values from Step 3 into `.env.local`.
4. ```
   npm run dev
   ```
5. Open http://localhost:3000 → log in with the Master account from Step 4.

## Step 6 — Push to GitHub

1. Create a new **private** repository on GitHub (keep it private — the
   `.env.local` file is already excluded via `.gitignore`, but private is
   good practice regardless for an org finance tool).
2. From this project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

## Step 7 — Deploy to Vercel

1. Go to https://vercel.com → sign up/log in with GitHub → **Add New Project**.
2. Import the repository you just pushed.
3. Before clicking Deploy, open **Environment Variables** and add the same
   three values from Step 3:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. In ~2 minutes you get a live URL like
   `ieee-sb-finance.vercel.app` — this is your real, hosted app.
5. Share that URL with your committee. Log in as Master → create Admin and
   User accounts for your team (Master page) → Admin creates fests, events,
   vendors, categories → everyone logs entries under Add Expense / Add Income.

---

## Day-to-day usage flow (matches how your branch actually works)

1. **Master** creates accounts for your 2-3 Admins and ~10 Users, once.
2. **Admin** creates a Fest (e.g. "TechFest 2026"), adds its Events/workshops,
   adds any new Vendors, and defines Categories (Stationery, Printing,
   Mementos, Electronics, Food, Creative, Volunteer Expenditure, Conveyance...).
3. **Anyone** opens the Fest → **Add Expense**:
   - *Vendor Purchase* — e.g. 200 pens from Vendor A, ₹2,000 total. Optionally
     split it across events right there (e.g. 80 pens / ₹800 to Workshop X,
     120 pens / ₹1,200 to Workshop Y) — or leave unallocated if it's a bulk
     buy you'll assign later.
   - *Volunteer Expenditure* / *Conveyance* — paid personally by a volunteer,
     marked reimbursed or not, still counted as Student Branch expense.
4. **Anyone** logs **Add Income**: daily registration counts + amount per
   event, sponsorships, or other income — even though the money itself
   routes through IEEE Gujarat Section, not your account.
5. **Overview** tab shows running totals, spend by vendor, spend by event,
   and income by event — automatically, no manual compilation.
6. **Export** tab, any time or at fest close: one Excel file with Summary +
   full Expense + Income sheets, Drive links included, ready to send.

## A note on Supabase's Security Advisor

Supabase runs its own automated security scanner (find it under **Advisors**
→ **Security** in your dashboard). Two issues it may flag were fixed in this
schema by design:

- **"SECURITY DEFINER function callable by anon/authenticated"** — an
  earlier version of this schema used a shared `get_role()` helper function
  for policies, which is directly callable via Supabase's auto-generated API
  even outside of policies. The current schema inlines the same logic
  directly into every policy instead, so nothing extra is exposed.

One issue it will likely keep showing, and that this project cannot fix
in code:

- **"Leaked Password Protection Disabled"** — Supabase checks new passwords
  against HaveIBeenPwned's breach database, but this feature is gated to
  their paid **Pro plan**. On the Free plan there's no code-level
  workaround. Partial mitigation already in place: the Master account
  creation form requires 8+ character passwords. If you upgrade to Pro
  later, enable it under **Authentication → Passwords**.


- Attach photos directly instead of Drive links → needs Supabase Storage,
  a moderate addition.
- Multi-branch / multi-section support → needs an `organizations` table and
  scoping every table to it.
- Approval workflow (Admin approves before an entry counts) → add a
  `status` column and an extra RLS check.

Come back to this project any time — the codebase is small and organized by
feature (`app/master`, `app/admin`, `app/fest/[festId]`), so extending one
part won't require touching the others.
