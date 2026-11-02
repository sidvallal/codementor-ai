# CodeMentor AI backend

FastAPI backend for CodeMentor AI. Phases 21-25 add code execution, Groq, RAG, private memory, and frontend integration. Phase 26 adds security/error handling checks and tests. Phase 27 adds container and deployment preparation. Progress, Dashboard, and Interview Mode use persisted submissions; interview chat and code feedback call the authenticated Groq-backed AI endpoints.

## Execution contract

Each language submission is a complete program. It reads one configured test case from standard input and writes its answer to standard output. Python uses `python3`, JavaScript uses `node`, Java uses a `public class Main`, and C++ uses `g++ -std=c++20`. The judge compares output after normalizing line endings and trimming trailing whitespace. Function-only snippets from the current editor are not adapted by this phase.

An administrator adds public and hidden input/output pairs to a problem's `test_cases`. `Run` executes only public cases and returns their expected and actual output. `Submit` executes every case and returns aggregate results only; hidden case input, expected output, actual output, and per-case status are not returned.

## Sandbox boundaries

The API host passes source and test data to Docker over standard input. It never evaluates submissions in the FastAPI process and never pulls images during a request. The trusted runner is baked into four prebuilt language images; each job uses a fresh container with:

- network disabled, read-only root filesystem, and a small writable tmpfs
- a memory limit with swap disabled, CPU quota, and PID limit
- all Linux capabilities dropped except the runner's narrow `SETUID`, `SETGID`, and `KILL` needs; submitted programs run as UID/GID 65534
- `no-new-privileges`, disabled core dumps, per-process CPU and output-file limits, wall-clock deadlines, and cleanup of leftover processes
- bounded source, test-data, output, test-count, concurrent-job, and overall-job sizes

The Docker daemon is part of the trusted computing base. Do not mount its socket into the API container or expose the daemon to submitted programs. These controls are a practical development sandbox, not a substitute for a dedicated hardened execution host or a microVM boundary for hostile multi-tenant production workloads.

## Local setup

Prerequisites: Python 3.11+, Docker Desktop or a Linux Docker Engine running Linux containers, and PostgreSQL. From PowerShell, run these commands.

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env with a running PostgreSQL URL and a newly generated JWT_SECRET_KEY.
# Set GROQ_API_KEY in this ignored local file to enable the AI endpoints.
# GROQ_MODEL defaults to openai/gpt-oss-120b.

# Build the trusted runtime images once. Run with backend/ as the build context.
docker build -f execution/docker/Dockerfile.python -t codementor-python:phase21 .
docker build -f execution/docker/Dockerfile.javascript -t codementor-javascript:phase21 .
docker build -f execution/docker/Dockerfile.java -t codementor-java:phase21 .
docker build -f execution/docker/Dockerfile.cpp -t codementor-cpp:phase21 .

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload
```

The images are intentionally not pulled or rebuilt while handling API requests. Rebuild them yourself when changing `execution/docker/runner.py` or updating a runtime version. The image tags can be changed in `.env` if you use a registry or immutable image digests.

The seed script creates local-only demo users, including `admin@example.com` with password `changeme123`. Change or remove these accounts before any shared or deployed environment.

## Manual Phase 21 check

1. Open `http://localhost:8000/docs`, sign in with the seeded admin account at `/api/auth/signin`, then use **Authorize** with the returned bearer token.
2. Create a temporary problem with a public and a hidden case:

```json
{
  "title": "Phase 21 addition smoke test",
  "difficulty": "Easy",
  "topic": "Arrays",
  "description": "Read two integers and print their sum.",
  "test_cases": [
    {"input": "2 3", "expected_output": "5", "hidden": false},
    {"input": "4 8", "expected_output": "12", "hidden": true}
  ]
}
```

3. Sign in with the seeded student account (`student@example.com`, password `changeme123`) and replace the token under **Authorize**. Call `/api/submissions/run` with the new problem ID, language `python`, and code `print(sum(map(int, input().split())))`. Expect `passed`, one public result, and actual output `5`.
4. Call `/api/submissions/submit` with the same code. Expect `Accepted`, two passed tests, and no hidden test data in the response.
5. Submit `print(1)` and expect `Wrong Answer`; submit `while True: pass` and expect `Time Limit Exceeded` after the configured time limit.

The seeded 29 problems do not contain judged test cases. Add cases through the admin problem API before running them. The React Run/Submit panel calls these endpoints; progress analytics also read persisted submissions from `/api/progress/me`.

## Configuration

The AI endpoints read `GROQ_API_KEY`, `GROQ_MODEL`,
`GROQ_TIMEOUT_SECONDS`, `GROQ_MAX_COMPLETION_TOKENS`, and
`GROQ_REASONING_EFFORT` from the backend
environment (see `.env.example`). Keep the real key in the ignored
`backend/.env` or a deployment secret manager; never commit it. Chat
retrieves the exact knowledge passages returned in `rag_context` from
ChromaDB. AI feedback is instructional and does not change judge status
or submissions.

For Docker Compose, `compose.yaml` loads `backend/.env` into the API
container. Compose reads root `.env` for required deployment values such
as `POSTGRES_PASSWORD` and `JWT_SECRET_KEY`. Put `GROQ_API_KEY` in
`backend/.env` for the checked-in Compose setup, or map it explicitly from
your deployment secret manager into the API service. Keep it out of all
`VITE_*` variables. `POSTGRES_PASSWORD` and
`JWT_SECRET_KEY` are required by Compose. Generate a unique JWT secret
with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

To check config locally from `backend/`, run:

```powershell
python -c "from app.config import settings; print(bool(settings.groq_api_key), settings.groq_model)"
```

The admin-only `GET /api/ai/health` reports key presence and model without
revealing the key. Add `?check_provider=true` to make a minimal Groq call
and verify connectivity. `/api/ai/review-code` is the simplest
Groq-only functional check; `/api/ai/hint` also needs a problem in the
database. `/api/ai/chat` additionally requires working Chroma and the
configured embedding model for knowledge retrieval and user memory.
RAG failures return 503 with Chroma/embedding guidance, missing keys and
rejected keys return distinct 503 messages, and other Groq failures
return 502.

The RAG service uses `CHROMA_PERSIST_DIR`, `RAG_COLLECTION_NAME`,
`RAG_EMBEDDING_MODEL`, `RAG_CHUNK_CHARS`, `RAG_TOP_K`,
`RAG_MIN_SIMILARITY`, and `RAG_MAX_CONTEXT_CHARS`. The first RAG call
loads the configured Sentence Transformers model and persists the shared
knowledge collection. `PersistentClient` is for local development; use a
server-backed Chroma deployment for a multi-instance production setup.
Admin-managed `source` values are provenance supplied by the admin; the
system never fabricates outside citations.

## Manual Phase 22 check

1. Put a valid Groq key in `backend/.env`, start the API from `backend/`,
   and open `http://localhost:8000/docs`. Sign in and authorize with a
   bearer token as described in the Phase 21 check.
2. Call `/api/ai/chat` with a question about hash maps. Expect an assistant
   reply, one or more real retrieved entries in `rag_context` when they
   pass the similarity threshold, and `trace: null`.
3. Call `/api/ai/review-code` with a problem statement and code. Expect
   the original prototype's correctness/errors/improvements sections and
   an explicit note that correctness was not executed or verified.
4. Call `/api/ai/hint` for a seeded problem at levels 1, 2, and 3. Expect
   a level-matched hint grounded in that problem.
5. Call `/api/ai/review` and `/api/ai/debug` with code that has not been
   submitted. The response should not claim that execution was verified.
   Then submit the exact same source through `/api/submissions/submit`
   and repeat; the AI may refer to that user's persisted aggregate status.
6. As an administrator call `/api/ai/problem-draft` for an Easy Arrays
   problem. Expect an explicitly unverified draft that is not persisted;
   student credentials should receive 403.
7. Temporarily remove `GROQ_API_KEY` and restart. AI calls should return
   503 with a configuration message and no provider or credential details.

If any real credentials were committed or shared, rotate the Groq key,
Postgres password, and `JWT_SECRET_KEY` before deployment. Example files
must contain placeholders only.

The API validates structured AI responses and returns 502 if the provider
fails or returns malformed output. This manual check requires a working
database, network access to Groq, and a valid key; unit tests use a fake
client and do not make provider requests.

## Manual Phase 23 check

1. Start the backend with requirements installed. As an admin, call
   `GET /api/rag/status`; expect `ready`, the configured collection/model,
   and ten seeded entries on a fresh collection.
2. Call `GET /api/rag/knowledge` and confirm the entries carry the honest
   CodeMentor curated-demo provenance. Add an entry with an accurate
   source, then edit and delete it through the admin routes.
3. Ask `/api/ai/chat` a question that matches the new entry. Confirm the
   exact retrieved chunk appears in `rag_context` and the mentor uses it.
   Ask an unrelated question and confirm no unrelated source is returned.
4. Restart the backend and call status/list again. Expect the knowledge
   entries and admin changes to persist under `CHROMA_PERSIST_DIR`.
5. Repeat an admin knowledge call with a student token. Expect 403.

The first RAG request may take longer while the embedding model loads.
It requires a writable Chroma directory and access to model files if
they are not already cached.

## Manual Phase 24 check

1. Set `RAG_MEMORY_COLLECTION_NAME` to a collection name distinct from
   `RAG_COLLECTION_NAME`; start the API with two valid student accounts.
2. As student A, `POST /api/memory` with a preference or learning
   observation, then `GET /api/memory` and `/api/memory/search`. Confirm
   the created record is returned with its category, topic, and timestamp.
3. Repeat the same GET and search as student B. Student A's record must
   not appear. Try deleting A's ID while authenticated as B; expect 404,
   then confirm A's record still exists. A can delete their own record.
4. As A, ask `/api/ai/chat` a question related to a saved observation.
   Relevant memory is included in `user_memory_used`; shared knowledge
   citations remain in `rag_context`. As B, the same question must not
   include A's memory.
5. Restart and repeat the list/search checks to confirm persistence. The
   first vector operation can load the embedding model and may take time.

Memory endpoints require a valid bearer token and return 503 when Chroma
or the embedding model is unavailable. `RAG_MEMORY_COLLECTION_NAME` must
remain distinct from the shared knowledge collection. Memory creation is
explicit; chat does not automatically infer or save personal facts.

## Manual Phase 16 check

1. Apply migrations and sign in as a student with a valid bearer token.
2. Call `GET /api/progress/me`. A new account returns zero attempts,
   zero solved problems, a zero streak, empty topic mastery, and an eight
   week trend with no timed points; no demo values are substituted.
3. Submit a judged problem, then call the endpoint again. The attempt
   count, accepted count, distinct solved count, difficulty totals, UTC
   accepted streak, topic mastery, and any recorded solving time should
   reflect only that user's saved submission.
4. Sign in as a second student and repeat. The first student's activity
   must not appear. `Run` does not persist and must not change either
   student's metrics.
5. Call `POST /api/progress/recommendations`. With Groq configured it
   returns recommendations grounded in aggregate metrics only; without
   a Groq key it returns 503 while the progress summary remains usable.

Accuracy is accepted saved submissions divided by all saved submit
attempts. Topic mastery uses distinct attempted problems, so repeat
submissions cannot inflate the denominator or duplicate solved problems.
AI recommendations are an explicit action and send no source code.

## Manual Phase 25 end-to-end check

1. Follow `README.md` to configure PostgreSQL, run migrations and seed
   development data, build the four Docker images, and start the API.
   Start Vite with `VITE_API_BASE_URL` set to the API origin.
2. Sign up with a new email. The API creates a student account and
   returns a bearer token. Refresh the page, then sign out and verify a
   protected route sends you back to sign-in. Signup does not grant admin.
3. Sign in as the local seeded admin. Create or edit a problem and add
   public and hidden cases whose stdin/stdout formats match a complete
   program. Save it, then open it as a student and try Run and Submit.
   Run shows public actual output; Submit shows aggregate results only.
   Check Submission history persists after refreshing. Function-only
   editor snippets are not wrapped by the execution service.
4. Use the admin Knowledge Base tab to add a genuine learning note.
   Ask the AI Mentor a related question and inspect the returned source
   panel. Groq and the local embedding model must be configured.
5. As a student, save a memory note in Profile and ask a related Mentor
   question. Sign in as a second student and confirm that note is absent
   from their profile and Mentor context. Delete the note as its owner.
6. On a saved problem, try AI Review, Hint, and Debug. Review/debug
   correctness is grounded in the matching user's persisted submission;
   browser-supplied test claims are not trusted. As an admin, generate a
   draft and confirm it is not published until saved through the problem
   form. Check student credentials receive 403 for admin APIs.

The browser stores bearer tokens in local storage for this integration;
an httpOnly cookie/session flow is outside this phase. Password reset,
community solving-time comparisons, and multi-agent routing are not active
backend flows. Dashboard and Progress metrics, Interview judging, and AI
feedback use authenticated backend routes. API errors are displayed to the
user rather than replaced with mock successes.

All execution limits are in `backend/.env.example` with conservative local defaults: 3 seconds per test, 20 seconds compile time, 180 seconds per job, 256 MiB memory, 0.5 CPU, 32 processes, 32 KiB output, 50 cases, and 2 active jobs per API process. These are environment-configurable through the `EXECUTION_*` variables; values should be tuned against the capacity of the Docker host.

If Docker or an image is unavailable, Run/Submit return a service error. There is no mock or host-process fallback. Public-test configuration errors return a conflict, invalid/oversized execution data returns a validation error, and saturation returns HTTP 429.

## Other backend modules

- `app/api/`, `app/schemas/`: authenticated API endpoints and validated contracts
- `app/models/`, `migrations/`: PostgreSQL source of truth and initial migration
- `app/auth/`: password hashing and JWT helpers
- `app/execution/`: Docker command policy, orchestration, request bounds, and result mapping
- `execution/docker/`: trusted language runner and Dockerfiles
- `API_CONTRACTS.md`: endpoint reference alongside generated Swagger docs at `/docs`

## Checks

From `backend/` with requirements installed:

```powershell
python -m pytest tests/ -v
python -m compileall -q app execution/docker tests
```

The Docker-backed manual check above additionally requires a running Docker daemon, all four images, and PostgreSQL. A passing unit/build check alone does not prove the external Docker engine is installed or available.
