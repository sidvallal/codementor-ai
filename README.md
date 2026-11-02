# CodeMentor AI

AI-powered DSA learning, code review, debugging and mentoring platform.
Final-year B.Tech CSE project, built in phases.

**Current status: Phases 25–30 are present** — the frontend uses authenticated
FastAPI services, including persisted Dashboard and Progress analytics,
on-demand AI recommendations, and live Interview Mode chat, judging, and
feedback. The backend includes Groq, Chroma RAG, private memory, persisted
submissions, security handling, and Docker Compose/Nginx deployment files.
Company-specific question banks, voice input, and password reset remain
unavailable; see `backend/README.md` and `deploy/README.md`.

## Backend

A separate FastAPI project lives in `backend/`. Set `VITE_API_BASE_URL`
in the root `.env` to the API origin (defaults to `http://localhost:8000`).
Never put the Groq key in a Vite variable; it belongs only in
`backend/.env`. Bearer access tokens are stored in browser local storage
because the current backend exposes bearer authentication rather than an
httpOnly cookie flow.

## Local end-to-end setup

1. Install frontend dependencies with `npm install` and copy root
   `.env.example` to `.env`. Vite uses `VITE_API_BASE_URL=http://localhost:8000`.
2. In `backend/`, create and activate a Python virtual environment,
   install `requirements-dev.txt`, copy `.env.example` to `.env`, and set
   a PostgreSQL `DATABASE_URL`, a strong `JWT_SECRET_KEY`, and a valid
   `GROQ_API_KEY`. Keep real credentials only in ignored `.env` files.
3. Apply migrations with `alembic upgrade head`, then seed the local
   development problems and accounts with `python -m app.db.seed`.
   The seed script documents its development-only demo credentials.
4. Start FastAPI from `backend/` with `uvicorn app.main:app --reload`.
   Build the four Docker runner images using `backend/README.md` before
   trying Run or Submit.
5. Start Vite from the project root with `npm run dev`. Sign-up creates
   a student account. Admin permissions come from the database role; an
   account cannot grant itself admin rights in the signup form.

For Compose, root `.env` supplies `POSTGRES_PASSWORD` and `JWT_SECRET_KEY`;
replace both example values before starting. Compose loads `backend/.env`
for the API, publishes it at `localhost:8000`, and serves the built site
at `localhost:8080` through Nginx. The built frontend uses relative `/api`
requests. Never put Groq credentials in `VITE_*` variables. See
`deploy/README.md` for the Compose startup steps.

The first RAG or memory request may download/load the configured local
embedding model. Groq features need a backend-only `GROQ_API_KEY`.
Password reset has no email/token backend and is unavailable. Dashboard
analytics, community comparison, company-specific interview banks, and voice
input remain clearly labeled demo/planned or unavailable features.

## Folder structure

```
src/
  components/   Sidebar, TopBar, MobileDrawer, NavItem, SearchBar,
                NotificationsMenu, ProfileMenu, ProtectedRoute,
                AdminRoute (Phase 18), ProblemCard, and components/ui/
                (Button, Avatar, Badge, IconButton, EmptyState, Panel,
                StatCard, FilterChip, ReviewSection)
  pages/        Dashboard (Phase 4), Problems + ProblemDetail (Phase
                5-11/18, real), AiMentor (Phase 12/13/15, real), Profile
                (Phase 14, real), Progress (Phase 16, real), Interview
                (Phase 17, real), Admin (Phase 18, admin-only), Practice
                (Phase 1, real) and pages/auth/ (SignIn, SignUp,
                ForgotPassword, ResetPassword) — all 7 main nav
                destinations plus the admin-only page are real now
  layouts/      AppShell.jsx (signed-in shell) and AuthLayout.jsx
                (centered layout for the auth pages)
  hooks/        custom React hooks (empty — later phases)
  services/     all API/data access lives here, nowhere else —
                includes agentService.js (Phase 15) and
                interviewService.js (Phase 17)
  utils/        difficulty.js, time.js, communityStats.js, testStatus.js
                (shared pass/fail check used by AI Review + AI Debugger)
  data/         navigation.js, dashboardMockData.js, problemsMockData.js
                (static seed data), problemStore.js (Phase 18 — the
                actual mutable catalog everything reads from now),
                languages.js, progressMockData.js
  context/      AuthContext.jsx — mock auth state via useAuth(), now
                including a role ('student' | 'admin', Phase 18)
  features/     larger self-contained feature modules (empty — later phases)
  assets/       icons/images/fonts (empty)
legacy/
  test.py       original Streamlit prototype, kept for reference
```

## Running locally

Use the end-to-end setup steps at the top of this README. The frontend
requires FastAPI at `VITE_API_BASE_URL` (default `http://localhost:8000`)
and authenticated API access. Local development needs PostgreSQL and
Docker for problem execution; Groq and the local embedding model are
needed for AI chat/review and memory/RAG personalization.

## Design system (Phase 2)

Dark-first, two accent colors that carry meaning rather than decoration:
**amber** for the learner's own work (nav highlights, primary buttons),
**indigo** for AI-generated content (AI Mentor nav item, mock-response
badge). Type: Sora for headings, IBM Plex Sans for body/UI, IBM Plex
Mono reserved for actual code/technical strings. Built with Tailwind CSS;
the one deliberate motion moment is the mobile drawer's slide-in
(Framer Motion) — no per-element hover animations elsewhere.

## Authentication and API integration (Phase 25)

Sign-up and sign-in call FastAPI and store a bearer access token in
`localStorage`. At startup the frontend validates the token with
`/api/auth/me`; a 401 clears the session. Student registration cannot set
the role. Admin-only pages also depend on server-side admin checks.
Password reset remains unavailable because no reset email/token API is
implemented. For production, replace browser-readable token storage with
an httpOnly cookie/session flow and add CSRF protections as appropriate.

## Persisted Progress (Phase 28)

The Progress page reads the authenticated user's saved submission analytics
from `/api/progress/me`: solved count, accuracy, streak, difficulty
distribution, weekly accepted solve times, topic mastery, and recent
improvements. Accounts without submission history see empty-state guidance
instead of fabricated metrics. AI recommendations are requested on demand
from `/api/progress/recommendations`, using aggregate metrics without source
code.

## Live Dashboard (Phase 29)

The Dashboard combines the authenticated progress summary, problem catalog,
and recent submission history. It shows real stats and activity, difficulty
completion against the catalog, topic-based suggestions drawn from unsolved
problems, recent improvements, and on-demand AI recommendations. Its suggested
problems are a transparent topic-priority rule, not AI-generated selections.

## Live Interview Mode (Phase 30)

Interview Mode now uses the authenticated mentor endpoint for its opening and
follow-up questions, the real Docker-backed submission endpoint for scoring,
and code review plus transcript-based AI feedback for its summary. The judge
result is persisted in the user's submission history. If an AI feedback call
fails after scoring, the summary still appears and identifies the unavailable
feedback. Problem selection requires a complete statement, examples, and
constraints. Company-specific question banks and voice input are not included.

## Admin and remaining demos

Admin problem and RAG knowledge management now call protected backend
CRUD APIs. The browser route guard is for navigation only; server role
checks provide the security boundary. Community comparison, password reset,
voice input, and company-specific interview question banks remain unavailable.
The multi-agent architecture is displayed as planned; Mentor and Interview
chat currently use the same backend chat endpoint. Code execution accepts
complete stdin/stdout programs and does not adapt function-only snippets.
- `problemStore.js` (new) wraps the problem catalog with real
  `createProblem`/`updateProblem`/`deleteProblem` — Problems,
  ProblemDetail, and Interview Mode all now read through it, so an
  admin's changes actually show up there.
- `ragService.js`'s knowledge base went from `const` to `let` with
  matching CRUD exports — an admin-added entry is immediately usable by
  the AI Mentor's real retrieval (Phase 13), in the same session.

I verified both of these are genuinely wired, not just structurally
present: added a knowledge entry, confirmed a query that previously
retrieved nothing now retrieves it, deleted it, confirmed retrieval
goes back to nothing — all by actually calling the functions, not by
reading the code and assuming it's connected.

**Test cases** (create/hide/unhide) are real *data* on a problem now,
editable in the admin form with a per-case hidden toggle. Phase 21's Docker
judge executes public cases on Run and all cases on Submit; hidden case data
is not returned to the client. Interview Mode now uses the same real judge.

**Generate + review, not generate + auto-publish**: `generateProblemDraft()`
deliberately produces a rough draft with placeholder example/constraint/
hint text (`TODO`s throughout) rather than something that looks
finished — opening straight into the edit form after generating is the
"review generated problems" step, not a rubber stamp. Verified the
draft actually respects a requested topic/difficulty and falls back
sensibly when none is given.

**Difficulty and topics** stay the fixed taxonomies the rest of the app
already uses (3 difficulties, 14 topics) — the admin form assigns them
to problems via the same dropdowns rather than allowing arbitrary new
values that would ripple inconsistency into Dashboard/Progress's
topic-based charts elsewhere.

## Interview Mode (Phase 17)

This section records the original Phase 17 implementation. Phase 30 now
replaces its mock interviewer turns, judge, and final feedback with authenticated
backend calls; the company-bank and voice limitations described below still apply.

A real timed session: setup (difficulty + topic focus) → session (timer,
problem, AI interviewer chat, code editor, one controlled hint) →
performance summary (execution result, time-vs-limit, AI feedback in 4
sections). Almost none of this invents new mock machinery — it reuses
what already exists and works:
- The **code editor** is the exact same Monaco component from Phase 7.
- **Scoring** uses the persisted backend Docker judge and is saved to the
  signed-in user's submission history.
- The **one controlled hint** reuses Phase 11's real hint content
  (always level 1 — the smallest clue, not the full graduated menu),
  capped at 1 use per interview and shown in the summary, which is what
  "hints with controlled availability" means here: a real, visible cost,
  not an unlimited helper.

**On "company/topic mode"**: there's no honest way to offer real
company-specific question banks — that would mean claiming knowledge of
how a specific real company actually interviews, with nothing real
behind it. This implements the topic half for real (a genuine filter
over the catalog) and treats no-topic-selected as the general,
company-agnostic mode, rather than inventing fake company-branded
content. Said plainly in the setup screen, not buried in a comment.

**Voice** remains unavailable. The mic button is disabled and explains this
in the UI.

**Question pool, honestly scoped**: the starter catalog has six problems
with a complete written statement, examples, and constraints. The Phase 30
picker also allows future admin-added problems that meet the same bar, and
reports an error when a chosen difficulty/topic has no eligible question.

## Learning Progress (Phase 16)

Recharts finally gets used — deliberately held back since Phase 4,
where I scoped Dashboard as the at-a-glance snapshot specifically so
Progress would have a real, undiluted analytics job to do. The page
covers every item from the spec: problems solved, accuracy, attempts,
and streak as stat cards; a difficulty-distribution donut chart; a
solving-time trend line chart; a topic-mastery bar chart across all 14
topics; strong/weak topics; recent improvements; and AI recommendations.

**Weak and strong topics are derived, not duplicated**: both lists come
from slicing the same `MOCK_TOPIC_MASTERY` array the chart renders —
lowest 3 and highest 3 — rather than being a second, separately
hand-written list that could quietly drift out of sync with the chart.
I verified this by actually running the derivation: confirmed it
produces exactly Dynamic Programming, Sorting, and Graphs as the weak
topics, matching Dashboard's weak topics from Phase 4 precisely,
because I kept the numbers consistent between the two files on purpose
(the same discipline as the Phase 5 Heaps/Sorting fix).

**Data structures kept real-backend-shaped**: every dataset here is a
flat array of plain objects (`{ topic, mastery }`, `{ week, minutes }`,
`{ difficulty, solved }`) — the shape a `SELECT ... GROUP BY` would
naturally produce, not a nested or UI-specific structure a real
PostgreSQL-backed API would need to be redesigned around later.

**A dependency caveat, same shape as Tailwind/Monaco/Framer Motion
before it**: Recharts isn't installed in this sandbox either, so I
externalized it for the import-graph check and verified the mock data
itself (sorting, slicing, consistency) by actually executing it — but I
have not seen these charts render. If a chart looks broken or a color
seems off, tell me specifics.

## Multi-Agent AI (Phase 15)

`src/services/agentService.js` defines the 9 specialized agents from
the spec as a real registry (id, role, status) and an `orchestrate()`
function implementing: Request → Orchestrator → Select Agent → Agent
Reasoning → (Groq) → Response → Critic/Reflection → Final Response.
AI Mentor now calls this instead of the plain reply function directly,
and shows **which agent handled each reply** plus what the critic did —
both real values read from the orchestrator's trace, not staged for
the demo.

**"Do not implement fake autonomous behavior just for visual effect"**
— the guardrail I kept coming back to while building this. Concretely:
- Interview Agent, Problem Generator Agent, and Analytics Agent are
  marked **Planned** and say so plainly when selected — they don't
  pretend to answer with fabricated interview questions or generated
  problems.
- Code Review, Debug, and Hint Agents are marked **Active** but are
  honest that a general chat message has no specific problem's code to
  work with — they point you to that problem's page instead of
  fabricating a review from nothing.
- Learning Coach and Complexity Agents delegate to the *same real code*
  Phases 12/13 already built (`chatWithMentor`, RAG retrieval) — the
  orchestrator composes existing capability rather than duplicating or
  re-answering.
- The Reflection/Critic Agent is a genuine check, not a decorative
  step: it re-runs the same correctness rule from Phase 10/11
  (`isPassingStatus`) against any test-result claim in a draft reply,
  independently of whichever agent produced it.

**A real gap the orchestrator's own testing exposed**: routing a
complexity question correctly selected the Complexity Agent, but its
reply fell through to a generic fallback that didn't mention complexity
at all — Phase 12's reply logic never had a complexity-specific branch.
Selecting the right agent isn't worth much if that agent's answer
doesn't actually address the question, so I added one and re-ran the
exact same query to confirm the reply is now genuinely on-topic (and,
via the existing RAG wiring, pulls in the Big-O knowledge entry too).

## User Memory (Phase 14)

The Profile page is real now: an Account panel (your actual signed-in
name/email from Phase 3's auth — no need to fabricate this, it's real
mock data already) and an **AI Memory** panel with the four sections
from the spec: Strengths, Weak areas, Learned patterns, and Recent
observations. `src/services/userService.js` gained a real `getMemory()`.

**The architecture point of this phase, made concrete**: structured
facts (solved counts, streaks) are meant for PostgreSQL later;
qualitative observations like "struggles with recursion" are meant for
ChromaDB, retrieved the same way `ragService.js`'s knowledge base will
be once Phase 23 lands. This file is that second kind of store, built
now with a deterministic stand-in instead of a real embedding index.

**The rule this phase is actually about**: *"Never expose another
user's memory."* `getMemory()` requires a `userId` and throws rather
than silently returning something without one — there's no such thing
as memory that isn't scoped to somebody. Every observation is
deterministically derived *from* the userId (a simple hash seeds which
demo observations get picked), so two different accounts genuinely see
different fabricated memory, never a shared blob. I verified all of
this by actually calling it: confirmed it throws with no userId and
with an empty string, confirmed the same user gets identical memory
across two calls (deterministic, not random noise), and confirmed two
different users get different memory with no internal duplicates —
output is in the phase report.

Every claim in the AI Memory panel is prefaced as demo data, not a real
assessment — worth being extra careful about here specifically, since
this is the one place in the app that makes claims *about the person*
rather than about their code.

## RAG (Phase 13)

`src/services/ragService.js` is a genuine retrieval pipeline, not a
stub — just backed by a small, self-written knowledge base (10 entries
across the 8 domains from the spec: DSA concepts, algorithms,
complexity, patterns, common mistakes, hints, interview patterns,
learning roadmaps) with simple keyword matching instead of real
embeddings. `chatWithMentor()` (Phase 12) now actually calls it before
replying, so retrieval genuinely shapes what comes back — this isn't
wired up and then ignored.

**The rule I was most careful about**: *"Do not fake citations to
documents that don't exist."* Every single knowledge entry's source is
labeled plainly as `"CodeMentor AI knowledge base (demo entry)"` — never
attributed to an external book, article, or site. It would have been
easy to make this feel more "real" by writing something like "Source:
CLRS" or "Source: GeeksforGeeks," but that would be fabricating a
citation this app has no actual right to claim, so I didn't.

**Frontend RAG status UI**, per the spec's four asks:
- **Retrieved context**: shown under any AI Mentor reply that used it
- **Knowledge source**: labeled per entry (see above — always honest)
- **Relevance**: a percentage per retrieved entry
- **Generated explanation**: the mentor's reply itself, now informed by
  what was retrieved
- A separate "How the AI Mentor retrieves knowledge" panel always shows
  the conceptual pipeline (Question → Retriever → Relevant Knowledge →
  Prompt → LLM → Answer) and is upfront that today's retrieval is
  keyword matching, not real search.

**A gap I found and fixed by actually testing it**, not just reading
the code: the literal suggested prompt on this page, "What should I
study next?", retrieved nothing on my first pass — my keyword list had
"what to study" but the natural phrasing was "study next," and a
substring match needs the exact phrase to appear. I added "study next"
as a keyword and re-ran it to confirm the fix — details in the phase
report.

## AI Mentor (Phase 12)

The AI Mentor nav item is no longer a placeholder — it's a real chat
interface (`src/pages/AiMentor.jsx`) with suggested starter prompts, a
scrolling message history, and a send form. `aiService.js` gained
`chatWithMentor()`.

**Conversation history architecture, for real**: every request sends
the *entire* message list, not just the latest turn — that's what a
real multi-turn Groq call (Phase 22) needs, and I verified it actually
works that way (a follow-up message gets a reply based on itself, not
the first message in the thread — see the phase report). The response
shape also included `ragContext` and `userMemoryUsed` fields from the
start, always empty at the time — Phase 13 (below) is what actually
started filling `ragContext` in; `userMemoryUsed` stays empty until
Phase 14, with no changes needed to this page's code either time.

**On the mock content**: rather than one generic canned reply for
everything, I matched simple keywords so each of the 8 example query
types from the spec (hint, why-wrong, optimal approach, what to study,
improve, compare, explain-error, explain-concept) gets a distinct,
topically relevant mock reply — verified all 8 (plus a random unrelated
message) actually produce 9 different responses, not the same text
nine times. It's still keyword matching, not real understanding, and
every reply says so.

Nothing here is saved: refreshing or leaving the page clears the
conversation, same as everything else that doesn't have a backend yet.

## AI Debugger + Hints (Phase 11)

**AI Hints** (left column, next to the problem description): a graduated
3-level system — Hint 1 is a small conceptual clue, Hint 2 a stronger
direction, Hint 3 near-solution guidance. Only the next hint is ever
offered at once (clean, one-button-at-a-time UX, not all revealed
together). For the 6 detailed problems, Hints 1-2 use the real authored
hints from Phase 6; every problem gets a Hint 3. **No full solution is
offered anywhere in this demo** — fabricating one on the fly would mean
generating algorithm code with no way to verify it's actually correct,
which is a worse failure mode than not offering it at all. That
capability is explicitly left for Phase 22, ideally paired with a real
correctness check.

**AI Debugger** (only appears after a failing Run or Submit — there's
nothing to debug otherwise): explains a **Likely Cause** and a
**Debugging Direction**. It does not rewrite your solution — that's not
a tone choice, it's structural: the mock response has no
"correctedCode" field at all, so a future real implementation can't
accidentally slide into handing over a fix instead of an explanation.

**A real bug I found and fixed while building this**: Phase 10's
correctness check only recognized the literal strings `'Accepted'` and
`'passed'`, but the normalizer that feeds it can also produce
`'Passed sample tests'` (when only Run, not Submit, has been tried).
That mismatch meant a genuinely passing sample-test result could get
mislabeled by the AI Review as "not fully correct yet" — not a false
claim of *success*, but a wrong claim in the *cautious* direction,
which is still a bug. I extracted the passing-status check into one
shared function (`utils/testStatus.js`) used by both the AI Review and
the new AI Debugger, so the two features can't disagree about what
counts as a pass, and verified the fix by actually running it (see the
phase report) rather than trusting the read-through.

## AI Code Review (Phase 10)

The problem page now has a full **AI Review** panel — the seven
sections from the spec: Overall Assessment, Bug Analysis, Time
Complexity, Space Complexity, Code Quality, Suggested Improvement,
Learning Tip. `src/services/aiService.js` gained `reviewSubmission()`
for this; the original `reviewCode()` (3 sections: correctness/errors/
improvements) is untouched and still powers the Practice page, since
Practice — like the original prototype — has no problem catalog or
execution context to draw on.

**The one rule this feature's honesty depends on**: the review is only
ever allowed to talk about correctness using real Run/Submit results,
never a guess.
- No run or submission yet → the review says correctness is
  unverified — it will not guess.
- Your last Submit (preferred) or Run result exists → the review's
  Overall Assessment states exactly what that result was and defers to
  it, never contradicting it.

I wrote this as one small, auditable function
(`buildCorrectnessAssessment` in `aiService.js`) specifically so it's
easy to check by reading, and then verified it — not just by eye,
but by actually running it against four cases (no results, Accepted,
Wrong Answer, empty code) and confirming none of them produce a false
claim of success. The other 6 sections are honestly-labeled generic
placeholders (they say plainly that they're not derived from reading
your actual code) since real per-code analysis needs Groq, which isn't
connected until Phase 22.

Architecture notes some of you may want to verify yourselves: the AI
call has been behind a service-layer function since Phase 1
(`aiService.js` — the UI never touches the model directly), and the
real `GROQ_API_KEY` has never been anywhere but `.env.example` as a
placeholder name, matching "move API logic into a service layer" and
"keep API key in environment variables" from the spec.

## Time + submission analytics (Phase 9)

- A **solving timer** ticks in the "Your code" panel header from the
  moment you open the problem. It's elapsed time on the page, not true
  idle-excluded "active" time, and it resets if you navigate away and
  back — no persistence yet.
- On an **Accepted** submission, a comparison block shows Your Time,
  Community Median (emphasized — the spec asks for median as the main
  comparison, since a couple of very slow outliers can drag an average
  up misleadingly), Community Average, and a Percentile. All of this is
  clearly labeled as demo data — see `utils/communityStats.js` for how
  it's fabricated (deterministically per problem, so it doesn't change
  every time the timer ticks) and a note on what "robust" averaging
  should mean once Phase 19+/20 has real submission data to filter.
- **Submission history** (attempt number, status, language, runtime,
  memory, solving time, date) accumulates as you submit during this
  visit to the page. It's session-only — refreshing or navigating away
  clears it, since nothing persists it yet.
- No other users' identities appear anywhere — the comparison is
  aggregate numbers only, real or mock.

## Run / Submit (Phase 8)

`src/services/submissionService.js` simulates execution — **there is no
real compiler, interpreter, or sandbox behind it**, and the UI says so
in a permanent caption under the Run/Submit buttons, not just a tooltip.

- **Run**: tests against 3 sample tests, shows a pass/fail badge and a
  fake runtime per test; for the 6 detailed problems, the real example
  input/expected output is shown alongside the result.
- **Submit**: tests against a simulated hidden suite (15/25/40 tests for
  Easy/Medium/Hard), returns Accepted, Wrong Answer, or Runtime Error,
  with a passed-count, and runtime + memory only when Accepted.
- Code left unchanged from the starter (or empty) always fails
  everything with a clear message — never a lucky pass on nothing
  written.
- Clicking Run and Submit are visually and functionally separate: each
  shows its own result panel, and starting one clears the other so
  they're never shown mixed together.

**A mock-modeling bug I caught while testing, not just writing**: my
first version flipped an independent coin per hidden test. With 25
tests at 80% each, the odds of *all* passing were about 0.4% —
"Accepted" would have been nearly unreachable, which reads as broken,
not realistic. I rewrote it so the whole submission's outcome is one
decision (60% chance of a full Accepted), which behaves the way real
code actually does — correct solutions pass everything, buggy ones fail
consistently rather than randomly per test. I verified the corrected
version actually produces sensible results (see the phase report) before
shipping it.

## Monaco editor (Phase 7)

`src/components/CodeEditor.jsx` wraps `@monaco-editor/react`. Supports
Python, Java, C++, and JavaScript; a Dark/Light theme toggle; a Reset
button that restores the current language's starter code; and real line
numbers/syntax highlighting (Monaco's defaults). Each language keeps its
own code buffer while you're on the page, so switching the language
dropdown back and forth doesn't lose what you typed in either one — that
does **not** currently survive navigating away from the page or a
refresh, since this component doesn't persist anywhere yet.

Six problems (the same six with full descriptions) have a starter
function signature tailored to match their actual problem — e.g. Two
Sum's Python starter is `def two_sum(nums, target):`, not a generic
placeholder. The other 23 get a generic `solve()` starter in each
language.

**One dependency worth knowing about**: this uses `@monaco-editor/react`'s
default CDN loader rather than bundling Monaco locally — the standard,
well-documented way to use it with Vite. That means the editor needs
internet access the *first* time it loads in your browser (to fetch
Monaco's assets from jsDelivr). Self-hosting Monaco to remove that
dependency is possible but needs extra Vite worker configuration I
didn't want to guess at without being able to test it — a reasonable
future improvement if you'd rather not rely on a CDN.

## Problem-solving page (Phase 6)

Click any problem in the catalog to open `/problems/:id`. Six well-known
problems (Two Sum, Valid Parentheses, Reverse Linked List, Binary
Search, Climbing Stairs, Merge Intervals) have full description/
examples/constraints/hints written out; the other 23 show an honest
"full statement not yet written" note instead of fake content. The code
area is a plain textarea for now — Monaco (Phase 7) and working Run/
Submit (Phase 8) are the next two phases, and the buttons are visibly
disabled rather than silently doing nothing.

## What's real vs. mock vs. planned right now

- **Real backend flows**: JWT signup/sign-in and `/me` validation;
  server-protected problem and RAG admin APIs; per-user problem status;
  Docker Run/Submit and persisted submission history; Groq review, hints,
  debugging, mentor chat, live interview chat and feedback, and admin draft
  generation; Chroma knowledge retrieval and explicitly saved, per-user
  memory; persisted per-user
  Dashboard and Progress analytics; on-demand AI progress recommendations.
- **Still demo or unavailable**: community comparisons; company-specific
  interview banks and voice input; password reset; notifications; search;
  full solution reveal; automatic memory extraction; and multi-agent
  orchestration/critic.
- **Execution contract**: Docker runs complete programs that read stdin
  and write stdout. Existing function-only starter snippets are not
  adapted automatically. Problems without configured test cases return
  a clear API conflict until an admin adds cases.

The phase notes above this section are a historical build journal. Their
descriptions of mock behavior reflect the phase in which they were
written. Phases 26–27 add backend security/error handling and deployment
preparation; their setup and limits are documented in `backend/README.md`
and `deploy/README.md`.
