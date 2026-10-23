# AGENTS.md — Free-Mode Build Playbook

Free-tier by default. Terminal agents only (Aider or OpenCode). Your own DeepSeek key is allowed only when you choose it (Section 6). One lifecycle for every project:

**PLAN → BUILD → TEST → FINALIZE**

Strategies change *how much process* a project gets. Stack presets change *which tool and models* run it. Pick one of each.

> **Token note:** this file is for startup and planning. Once the stack is chosen, the agent writes a 10-line RUNBOOK into the top of `PLAN.md` (Section 1, step 6). After that, Aider users can `/drop AGENTS.md`; OpenCode auto-loads it, so keep it short and never paste it elsewhere.

---

## TL;DR (read this first)

1. New session? → **Resume protocol** (Section 1A): read Control Panel + last `PLAN.md` handoff. Don't re-ask settled questions.
2. Fresh project with `STRATEGY: ASK`? → **Startup protocol** (Section 1): ask ≤3 questions, recommend one strategy + one stack, then auto-setup.
3. Set up? → work the current `PHASE`, one scoped micro-task at a time, tests with every task.
4. Stuck/failing/limited? → **STOP & ESCALATE box** (Section 4A). Never loop a 3rd time, never go paid/weaker silently.

---

## 0. CONTROL PANEL

```yaml
STRATEGY: S3          # ASK | S1 | S2 | S3 | S4 | S5
STACK: B             # ASK | A | B | C | D | E | F | CUSTOM   (default A)
PHASE: PLAN            # PLAN | BUILD | TEST | FINALIZE
PROJECT_NAME: "shikshit"
PROJECT_TYPE: "web app"       # web app | API | CLI | data/trading | script | existing codebase
TECH_STACK: "React 18 + Vite + TypeScript + Bootstrap 5 + React Router + SignalR"         # e.g. FastAPI + SQLite, Next.js + Postgres
DATA_SENSITIVITY: normal   # normal | sensitive
ALLOW_DEEPSEEK: false      # true only if the user says so (pay-as-you-go key)
KEYS_PATH: "~/Documents/Work/ai-toolkit/config/ai-keys.env"   # keys file; co-located with this playbook (Section 6A)
AUTO_INSTALL: false        # true = agent may install missing tools without asking
FALLBACK_ORDER: "omniroute > openrouter > nim > groq"         # filled by setup, e.g. omniroute > openrouter > nim > groq
MAX_FIX_ATTEMPTS: 2        # same failure: retry this many times, then STOP & ESCALATE
RESUME: auto               # auto = on new session, reload state from files before acting
```

---

## 1. STARTUP PROTOCOL

If `STRATEGY` is `ASK`, **stop. No code, no commands.** Send ONE message that:

1. Asks: *"What are we building, and is it new or an existing codebase?"* and, if `KEYS_PATH` is empty, *"Where is your keys file?"* (skip anything already filled)
2. Shows the strategy menu (Section 3) and the stack/combo menu (Section 6A) in one line each.
3. Recommends one strategy and one stack, with a one-sentence reason.
4. Asks: *"Go with the recommendation, or pick different ones (for example: S2 + OpenCode/OmniRoute)?"*

Then:
5. Run the **CONNECT & ROUTE** protocol (Section 6A) for the chosen stack. The user only provides keys and `KEYS_PATH`; the agent installs, connects, configures, and tests everything.
6. Write the choice into the Control Panel and add a **RUNBOOK** (max 10 lines: strategy, stack, chosen models, launch command, phase gates, rules summary) at the top of `PLAN.md`.
7. Continue with the PLAN phase.

Rules: max 3 questions. If the user says "you decide", use your recommendation and say so. Ask again only at phase boundaries (*"Phase done. Continue to <next phase>?"*) or when repeated rate limits suggest switching stack (C, D, or E).

## 1A. RESUME PROTOCOL (every new session on an existing project)

Before doing anything, if `RESUME: auto`:
1. Read the **Control Panel** (strategy, stack, phase, fallback order) — these are already settled; do not re-ask them.
2. Read the **last Session handoff** at the bottom of `PLAN.md` (done / in-progress / next task / limits hit).
3. Read `ARCHITECTURE.md` (read-only) and only the **current task's** files.
4. State in one line: *"Resuming <strategy>/<stack>, phase <X>, next task <T>."* Then continue. No full-repo scan, no re-setup unless a route is dead (then Section 6A for the broken part only).

---

## 2. PROJECT FILES (the agent's memory, so chat history isn't needed)

| File | Purpose | Rule |
|------|---------|------|
| `ARCHITECTURE.md` | Stack, folders, modules and responsibilities, data model, key decisions. **Max 1 page.** | **Locked.** Change only with user approval. |
| `PLAN.md` | RUNBOOK + micro-tasks with acceptance tests and status + session handoffs | Update after each task |
| `TESTPLAN.md` | Feature-by-feature test checklist | Created in PLAN, used in TEST |
| `BUGS.md` | Bug log: id, symptom, repro, severity, status | Updated in TEST |

**Context rule:** read the Control Panel, `ARCHITECTURE.md`, and the *current task only*. Never scan the whole repo. Never re-read files that haven't changed.

---

## 3. STRATEGIES (by project shape)

| ID | Strategy | Use when |
|----|----------|----------|
| **S1** | Quick Task | One script, fix, or feature touching 1–3 files |
| **S2** | Standard Project | New app or tool with several features. **Default.** |
| **S3** | Large Project | Many modules, multiple weeks, needs contracts between parts |
| **S4** | Data / Trading overlay | Backtests, analytics, filings, trade logs. Combine with S1–S3 |
| **S5** | Test & Debug Existing Code | Code already exists; find and fix bugs, verify every feature |

### Phase gates (shared by S1–S3; do not skip a gate)

| Phase | S1 Quick | S2 Standard | S3 Large |
|-------|----------|-------------|----------|
| **PLAN** | 5-line inline plan + one acceptance command | Brief → Gemini writes `ARCHITECTURE.md` + `PLAN.md` (vertical slice first) + `TESTPLAN.md` | S2 **plus** interfaces first: DB schema, API contracts, types. Split `PLAN.md` by milestone; load only the current one |
| **BUILD** | One session | One micro-task per session, slice by slice. Tests written with each feature | Module by module behind the contracts. Contract tests per module. Architecture review with Gemini every ~5 tasks |
| **TEST** | Run the command, check manually | Automated tests per task; `TESTPLAN.md` run after each slice and in full at the end | S2 **plus** integration tests across modules and a regression run before each milestone closes |
| **FINALIZE** | Commit | Final review, cleanup, README, changelog, tag | S2 **plus** architecture-vs-code audit, docs per module, release notes |

**Micro-task sizing (BUILD unit):** one task = one feature/slice, ideally **≤3 files**, with **exactly one acceptance test/command**. If a task needs >3 files or >1 acceptance, split it in `PLAN.md` first.

### S4 — Data / Trading overlay
- Output is research and tooling, **never financial advice or live-market prediction.** Verify numbers independently. No broker credentials in AI context; paper trade first.
- PLAN: Gemini reads data samples (remove account details) and drafts `strategy.md`: entry, exit, sizing, risk limits, universe, timeframe.
- BUILD: small modules: `data.py`, `signals.py`, `backtest.py`, `metrics.py`, `tests/`.
- TEST: out-of-sample or walk-forward split, fees and slippage included, parameter sensitivity, compare against buy-and-hold. Check for look-ahead and survivorship bias.
- FINALIZE: reasoning-model review of code and results for bias and bugs.

### S5 — Test & Debug Existing Code
1. **Map:** let the tool build its repo map; ask Gemini (with file tree + key files) for a feature list and risk areas. Save as `TESTPLAN.md`.
2. **Test each feature:** automated where possible, manual checklist otherwise. Log every failure in `BUGS.md` (id, symptom, repro, severity).
3. **Fix one bug per session:** write a failing test first, then the smallest fix, then rerun the full suite for regressions.
4. **Close:** all high/medium bugs fixed or consciously deferred, regression suite green, then FINALIZE.

---

## 4. QUALITY BAR (no compromise on implementation)

- Complete, working code. No stubs, placeholders, or `TODO` unless the plan lists them.
- Every feature ships with its test. Acceptance test is defined in `PLAN.md` before coding starts.
- Follow `ARCHITECTURE.md`. If the design must change, stop and propose the change; do not drift silently.
- Validate input and handle errors at boundaries (user input, network, files, DB).
- No new dependencies without asking.
- Read each file you edit in full before editing it.
- Report what was actually run and its output. "Should work" is not done.

## 4A. STOP & ESCALATE (single source of truth for when to halt)

Stop and report — do **not** keep looping — on any of these:

| Trigger | Action |
|---|---|
| Same failure hit `MAX_FIX_ATTEMPTS` (default 2) | Shrink to the smallest repro → escalate to the reasoning model once → if still failing, ask the user. Never try the same approach a 3rd time. |
| All routes in `FALLBACK_ORDER` failed | Stop. Report which routes failed and why. Do not invent a route. |
| A fix would need to change `ARCHITECTURE.md` | Stop. Propose the design change and wait for approval (no silent drift). |
| A task needs >3 files or a new dependency | Stop. Re-split in `PLAN.md` / ask before adding the dep. |
| Only a paid/DeepSeek/weaker route remains mid-BUILD | Stop and ask. Never switch to paid (unless `ALLOW_DEEPSEEK: true`) or to a clearly weaker model silently. |
| `DATA_SENSITIVITY: sensitive` and only free-cloud routes exist | Stop. Switch to Stack D (local) or use mock data. |

Always log the stop reason in the `PLAN.md` handoff before ending the turn.

---

## 5. TOKEN EFFICIENCY (save tokens through scope, not by lowering quality)

### Model roles (single source of truth — Sections 6/6A must match this)

| Role | Picked from | Used for |
|------|-------------|----------|
| **planner** | largest-context free model (Gemini) | PLAN, architecture, reviews, big reads |
| **coder** | best free coding model available | BUILD — never downgrade to save tokens |
| **weak** | a fast/cheap free model | boilerplate, wiring, formatting, trivial edits |
| **reasoner** | a free reasoning model (or DeepSeek reasoner if `ALLOW_DEEPSEEK`) | hard logic, stubborn bugs — used sparingly |

Rules:
- **Scope lock:** one micro-task, named files, fresh session per task.
- **Diffs not rewrites.** No re-printing unchanged code.
- **Loop guard:** obey `MAX_FIX_ATTEMPTS`; then go to the STOP & ESCALATE box (4A).
- **Persistent context in files**, not chat: `ARCHITECTURE.md` loaded read-only; `PLAN.md` handoff updated each session.
- **Free-tier hygiene:** free endpoints may log or train on prompts. If `DATA_SENSITIVITY: sensitive`, use mock data or Stack D (local). Keys live in `.env` and are never printed or committed.
- **Stay free by default.** Never suggest a paid plan, model, or tool. The one exception is the user's own DeepSeek key, used only when `ALLOW_DEEPSEEK: true` or the user asks. If free quotas run out, switch stack (C, D, or E) or wait for reset.
- **Don't invent.** Model IDs and free limits change; if unsure, say so and point to the provider page.

### Model auto-selection (run this; never hard-code a `:free` slug)

Free model names are added / renamed / removed constantly ("No endpoints found for X" = the slug is gone). So the agent **discovers and picks per role** at setup, and re-picks whenever a model 404s. Match on **family + capability**, not fixed names.

1. **Fetch the live free list** (OpenRouter shown; other OpenAI-compatible providers use `<base>/v1/models`; Ollama uses `ollama list`):
```bash
curl -s https://openrouter.ai/api/v1/models \
 | python3 -c "import sys,json;[print(m['id'], int(m.get('context_length') or 0)) for m in json.load(sys.stdin)['data'] if m['id'].endswith(':free')]" \
 | sort -k2 -nr
```

2. **Rank each role against the live list** (prefer by family, in order; names will vary):

| Role | Prefer (first match wins) | Hard requirement | Tie-break |
|------|---------------------------|------------------|-----------|
| **planner** | `gemini` → large `qwen` → large `llama` → `deepseek` v3 | biggest `context_length` | largest context |
| **coder** | `deepseek`(v3/coder) → `qwen*coder` → `llama`/`mistral` code → `gemini` | coding-capable; tool-use if the combo needs it | stronger coding rep |
| **weak** | `flash` → small `qwen` → small `llama`/`gemma` | fast + cheap | lowest latency |
| **reasoner** | `r1`/`deepseek*r1` → `qwq`/`qwen*reason` → other CoT | reasoning/chain-of-thought | strongest reasoning |

Match by substring (`deepseek`, `r1`, `qwen`, `coder`, `llama`, `gemini`, `flash`, `gemma`, `qwq`) so a renamed slug in the same family is still picked.

3. **Verify the top candidate before committing** (one tiny ping):
```bash
curl -s https://openrouter.ai/api/v1/chat/completions \
 -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
 -d '{"model":"<candidate>","messages":[{"role":"user","content":"Reply with OK"}]}' | head -c 300
```
- `No endpoints found for <model>` → slug retired → drop it, take the next ranked candidate.
- `No endpoints found that support tool use` → OK for plan/chat; for a tool-using combo pick a tool-capable model instead.
- Every free candidate 404s → enable **openrouter.ai/settings/privacy** (free endpoints need the data opt-in), then re-run from step 1.

4. **Record** the winner per role in the `PLAN.md` RUNBOOK (`planner=… coder=… weak=… reasoner=…`). Use those until one 404s.

5. **Self-heal on failure** — if a role's model dies mid-run: re-run steps 1–3 for that role only, update its RUNBOOK line, tell the user in one line, continue. Never loop on a dead slug (STOP & ESCALATE, 4A). When a whole provider is exhausted, re-select roles against the next provider in `FALLBACK_ORDER`.

Ignore file for the agent (`.aiderignore`; OpenCode respects `.gitignore`):
```
node_modules/
dist/
build/
.next/
.git/
venv/
__pycache__/
*.lock
package-lock.json
*.min.js
*.log
data/raw/
coverage/
```

---

## 6. STACK PRESETS (tool + models; independent of strategy)

| ID | Stack | Use when |
|----|-------|----------|
| **A** | Aider + OpenRouter free models (+ Gemini for planning) | Default; best token efficiency |
| **B** | OpenCode + OpenRouter free models (+ Gemini for planning) | Prefer an interactive terminal UI |
| **C** | A or B behind a LiteLLM failover proxy | Frequent rate limits |
| **D** | A or B with Ollama local models | Sensitive data, offline, or all quotas used up |
| **E** | A or B behind OmniRoute (local gateway) | Many free models and automatic fallback with little setup |
| **F** | A or B → LiteLLM → OmniRoute + direct providers | Maximum resilience: chained gateways with ordered fallbacks |

Your DeepSeek key can be added to any stack (see "Optional: your own DeepSeek key" below).

### Providers (free tiers; verify limits and model IDs before relying on them)

| Provider | Base URL | Env var | Role |
|----------|----------|---------|------|
| OpenRouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | Main router; models whose ID ends in `:free` |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai/` | `GEMINI_API_KEY` | Planning, review, big-context reading |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY` | Failover, free credits |
| Groq | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | Fast iterations |
| DeepSeek (your own key) | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` | Strong coder/reasoner. Pay-as-you-go, so only when you choose it |
| OmniRoute (local) | `http://localhost:20128/v1` | `OMNIROUTE_API_KEY` (if you set one) | Gateway to many free providers with auto fallback |
| Ollama | `http://127.0.0.1:11434` | none | Local, unlimited, private |

```
# keys file: KEYS_PATH points here. Keep it outside the repo, chmod 600
OPENROUTER_API_KEY=
GEMINI_API_KEY=
NVIDIA_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=      # optional, your own key
OMNIROUTE_API_KEY=     # optional, if you set one in the OmniRoute dashboard
```

### Stack A — Aider
```bash
python -m pip install aider-install && aider-install
```
`.aider.conf.yml` (replace `<free-model-id>` with a current free coding model from OpenRouter; verify it exists):
```yaml
model: openrouter/<free-model-id>
weak-model: openrouter/<free-model-id>
read: [ARCHITECTURE.md]        # persistent context, read-only
auto-commits: true
gitignore: true
map-tokens: 1024
test-cmd: <your test command>  # e.g. pytest
auto-test: true                # re-runs tests after edits; obey the 2-attempt loop guard
```
```bash
aider src/feature.py tests/test_feature.py     # only files in scope
aider --model openrouter/<free-reasoning-id>   # hard-logic session
aider --model gemini/<gemini-model-id>         # Gemini as the model
```
Inside Aider: `/ask` to discuss without edits, `/run <cmd>` for tests, `/clear` between tasks, `/drop` files you no longer need.

### Stack B — OpenCode
```bash
npm i -g opencode-ai        # or follow install steps on opencode.ai
opencode auth login         # choose OpenRouter, paste key
opencode                    # run inside the project folder
```
Pick a free model in the picker. Custom or proxy providers go in `opencode.json` (check the OpenCode docs for the current schema).
OmniRoute with OpenCode: see Stack E.

### Stack C — LiteLLM failover (self-hosted, free)
> LiteLLM's **default port is 4000**; we pin 4000 here (8000 commonly clashes with dev servers). Keep it consistent everywhere.
```bash
pip install 'litellm[proxy]'
litellm --config config.yaml --port 4000
```
`config.yaml` (verify every model ID):
```yaml
model_list:
  - model_name: planner
    litellm_params: {model: gemini/<gemini-flash-id>, api_key: os.environ/GEMINI_API_KEY}
  - model_name: coder
    litellm_params: {model: openrouter/<free-coding-id>:free, api_key: os.environ/OPENROUTER_API_KEY}
  - model_name: coder-backup-1
    litellm_params: {model: openai/<nim-model-id>, api_base: "https://integrate.api.nvidia.com/v1", api_key: os.environ/NVIDIA_API_KEY}
  - model_name: coder-backup-2
    litellm_params: {model: groq/<groq-model-id>, api_key: os.environ/GROQ_API_KEY}
  - model_name: reasoner
    litellm_params: {model: openrouter/<free-reasoning-id>:free, api_key: os.environ/OPENROUTER_API_KEY}
router_settings:
  num_retries: 2
  fallbacks:
    - coder: [coder-backup-1, coder-backup-2]
    - reasoner: [coder]
```
Aider: `export OPENAI_API_BASE=http://localhost:4000 OPENAI_API_KEY=anything` then `aider --model openai/coder`.
OpenCode: add an OpenAI-compatible provider at `http://localhost:4000/v1` with models `planner`, `coder`, `reasoner` (see OpenCode docs).

### Stack D — Ollama (local)
```bash
# install Ollama from ollama.com, then pull a coding model that fits your RAM/GPU
ollama pull <coding-model>
export OLLAMA_API_BASE=http://127.0.0.1:11434
aider --model ollama_chat/<coding-model>
```
For OpenCode, add Ollama as an OpenAI-compatible provider at `http://127.0.0.1:11434/v1`. Local models are weaker: use smaller tasks, more explicit instructions, one or two files at a time. Plan with Gemini only if the brief contains no sensitive data.

### Stack E — OmniRoute (local gateway to many free models)
```bash
npm install -g omniroute
omniroute        # dashboard + API at http://localhost:20128
# or: docker run -d --name omniroute -p 20128:20128 diegosouzapw/omniroute:latest
```
1. Open `http://localhost:20128` → **Providers → Add Provider**. Keyless free providers (e.g. OpenCode Free, Pollinations) work without any key. Add your own free-tier keys (Gemini, NIM, Groq, OpenRouter) for more headroom. Live remaining quota is on its `/dashboard/free-tiers` page. The agent can add providers from the CLI (Section 6A).
2. List what you can call: `curl http://localhost:20128/v1/models`. Use `auto` (or a named combo, a chain of models with automatic fallback) as the model name.
3. Point the agent at `http://localhost:20128/v1`:
```bash
# Aider
export OPENAI_API_BASE=http://localhost:20128/v1
export OPENAI_API_KEY=<your OmniRoute key, or any string if none is set>
aider --model openai/auto
```
```jsonc
// OpenCode: opencode.json (or run: omniroute config opencode --baseUrl http://localhost:20128)
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "omniroute": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OmniRoute",
      "options": { "baseURL": "http://localhost:20128/v1" },
      "models": { "auto": { "name": "auto" } }
    }
  }
}
```
Check the OmniRoute README for current commands and config format.

**Rules for Stack E**
- **Free only:** connect only free providers. Skip its subscription, API-key, and cheap tiers unless the user explicitly says otherwise.
- **Protect quality:** `auto` may pick a weaker model. Use `auto` for planning, chat, and small tasks. For BUILD and hard bugs, pin a strong coding model or a combo you trust, and escalate per the STOP & ESCALATE box (4A).
- **Data hygiene:** each request goes to whichever free provider serves it. Treat it as free-tier: no sensitive data, no secrets in context.
- **Security:** keep it on localhost, set an API key in the dashboard, and never tunnel or expose port 20128 publicly.
- **Reliability:** free and keyless providers can change or disappear. Keep an OpenRouter or Gemini key ready as a direct fallback (Stack A or B). Verify the project is current/maintained and use the official repo; several forks exist.

### Optional: your own DeepSeek key (works with any stack)
Pay-as-you-go, so use it only when `ALLOW_DEEPSEEK: true` or the user asks. Best uses: BUILD tasks where free models fail twice, hard-logic bugs, and large careful refactors. Keep the task scope tight to control cost.
```bash
export DEEPSEEK_API_KEY=<your key>
aider --model deepseek/deepseek-chat          # implementation
aider --model deepseek/deepseek-reasoner      # hard logic (verify current model names)
```
- OpenCode: `opencode auth login` → DeepSeek, then pick the model in the picker.
- LiteLLM (Stack C): add a `deepseek/deepseek-chat` entry with `api_key: os.environ/DEEPSEEK_API_KEY` and place it first in a fallback list.
- OmniRoute (Stack E): Providers → Add Provider → DeepSeek, paste the key.
- DeepSeek's API caches repeated prompt prefixes (confirm on their pricing page), so keep stable context such as `ARCHITECTURE.md` unchanged between calls.

---

## 6A. CONNECT & ROUTE (agent runs this automatically after the user picks a stack)

The user provides only two things: **the API keys** and **`KEYS_PATH`** (the file that holds them). Everything below is done by the agent.

### How the layers connect

```
 YOU (terminal)
   │
 AGENT      Aider | OpenCode              reads AGENTS.md, ARCHITECTURE.md, PLAN.md
   │         every hop speaks the OpenAI-compatible API, so each layer needs only: BASE_URL + API_KEY + MODEL
 GATEWAY    none | OmniRoute :20128 | LiteLLM :4000 | LiteLLM → OmniRoute     (retries, fallbacks, route replacement)
   │
 PROVIDERS  Gemini · OpenRouter · NIM · Groq · Ollama · OmniRoute's free providers · DeepSeek (only if ALLOW_DEEPSEEK)
```

### Combo menu (shown at startup; the user answers with a preset letter or three picks)

| Pick | Options |
|------|---------|
| 1. Agent | Aider, OpenCode |
| 2. Gateway | none, OmniRoute, LiteLLM, LiteLLM → OmniRoute (chain) |
| 3. Models | free cloud (from keys found), local Ollama, + DeepSeek (only if allowed) |

Presets: **A** Aider/none · **B** OpenCode/none · **C** LiteLLM · **D** Ollama · **E** OmniRoute · **F** chain (agent → LiteLLM → OmniRoute + direct providers) · **CUSTOM** any valid pick above.

### Wiring table (what each combo uses to connect)

| Combo | Agent talks to | Model name the agent uses | Route replacement done by |
|-------|----------------|---------------------------|---------------------------|
| A Aider direct | provider directly (`openrouter/…`, `gemini/…`) | provider-prefixed ID | the agent (see FALLBACK_ORDER) |
| B OpenCode direct | provider via `opencode auth login` | picked in the model picker | the agent (FALLBACK_ORDER) |
| C LiteLLM | `http://localhost:4000` | `coder`, `planner`, `reasoner` | LiteLLM `fallbacks` + `num_retries` |
| D Ollama | `http://127.0.0.1:11434` | `ollama_chat/<model>` | none (single local route) |
| E OmniRoute | `http://localhost:20128/v1` | `auto`, a combo name, or `omniroute/<model>` in OpenCode | OmniRoute skips failed providers and tries the next in the combo |
| F chain | `http://localhost:4000` (LiteLLM) | `coder` | LiteLLM falls back to OmniRoute, then other providers; OmniRoute fans out again |

### Keys file rules (`KEYS_PATH`, default `~/Documents/Work/ai-toolkit/config/ai-keys.env`)
- Plain `NAME=value` lines (names as in the `.env` template). Keep it outside the repo, `chmod 600`. If it is inside the repo, add it to `.gitignore` first.
- The agent **never prints, cats, echoes, logs, or pastes key values**, and never copies them into project files, prompts, or chat. It reads **names only** (e.g. `grep -o '^[A-Z0-9_]*=' "$KEYS_PATH"`) and reports "set" or "missing".
- Keys are loaded into the shell with `set -a; . "$KEYS_PATH"; set +a` and referenced by variable name (`$GEMINI_API_KEY`, `os.environ/GEMINI_API_KEY`).
- `DEEPSEEK_API_KEY` is ignored unless `ALLOW_DEEPSEEK: true`.

### Setup protocol (run in order; stop and report on the first failure)

**Step 0 — Preflight.** Read key names from `KEYS_PATH`. Report found providers and missing ones. If the chosen combo needs a key that is missing, say which variable name to add and offer a combo that works with what exists.

**Step 1 — Tools.** Check only what the combo needs: `node -v`, `python3 --version`, `aider --version`, `opencode --version`, `omniroute --version`, `litellm --version`, `ollama --version`. If anything is missing, list the exact install commands (Section 6) and ask **one** confirmation (skip if `AUTO_INSTALL: true`). Then install.

**Step 2 — Start the gateway** (only if the combo has one).
- *OmniRoute (E, F):*
```bash
set -a; . "$KEYS_PATH"; set +a
nohup omniroute > /tmp/omniroute.log 2>&1 &        # dashboard + API on :20128
omniroute status
# add each free provider whose key exists (verify provider IDs first)
omniroute providers available --category api-key
omniroute setup --non-interactive --add-provider --provider <provider-id> --api-key "$GEMINI_API_KEY" --test-provider
omniroute provider list
curl -s http://localhost:20128/v1/models -H "Authorization: Bearer $OMNIROUTE_API_KEY" | head -c 600
```
Keyless free providers need no key. If a command is not recognized, run `omniroute --help` and the matching `--help`; if provider adding cannot be scripted, tell the user which providers to add in the dashboard (`http://localhost:20128` → Providers → Add Provider) and wait. Connect free providers only.
- *LiteLLM (C, F):* generate `config.yaml` **only from keys that exist**: one `model_list` entry per available provider, and `fallbacks` that reference entries that exist. Then:
```bash
nohup litellm --config config.yaml --port 4000 > /tmp/litellm.log 2>&1 &
curl -s http://localhost:4000/v1/models | head -c 400
```
For the chain (F), add OmniRoute as an upstream inside LiteLLM and put it in the fallback list:
```yaml
  - model_name: coder-backup-omni
    litellm_params: {model: openai/auto, api_base: "http://localhost:20128/v1", api_key: os.environ/OMNIROUTE_API_KEY}
router_settings:
  num_retries: 2
  fallbacks:
    - coder: [coder-backup-omni, coder-backup-1]
```
(If OmniRoute has auth off, set `OMNIROUTE_API_KEY` to any string.)
- *Ollama (D):* `ollama list`; pull a model only if none fits.

**Step 3 — Configure the agent.** Never leave `<placeholders>`: run the **Model auto-selection procedure (Section 5)** to pick a real, verified slug for each role (planner/coder/weak/reasoner). Show the user the picks in one line; ask only if ambiguous.
- *Aider:* write `.aider.conf.yml` (Section 6 Stack A) with the chosen model. Gateway combos add `OPENAI_API_BASE` and `OPENAI_API_KEY` exports and use `--model openai/<name>`.
- *OpenCode via OmniRoute:* `omniroute setup-opencode --dry-run`, then `omniroute setup-opencode` (writes `~/.config/opencode/opencode.json`; run with `opencode -m omniroute/<model>`). For LiteLLM or direct providers, write the project `opencode.json` provider block (Stack E format with the right `baseURL`).

**Step 4 — Smoke test every route.** One tiny request per route in the combo ("Reply with OK"):
```bash
curl -s <BASE_URL>/chat/completions -H "Content-Type: application/json" \
  -H "Authorization: Bearer $<KEY_VAR>" \
  -d '{"model":"<model>","messages":[{"role":"user","content":"Reply with OK"}]}' | head -c 300
```
Report pass or fail per route. Do not start the PLAN phase until at least the planning route and the build route pass.

**Step 5 — Record and hand over.** Update the Control Panel (`STACK`, `FALLBACK_ORDER`), and write into the RUNBOOK in `PLAN.md`: the stack, the chosen models, and the exact launch command. If the chosen agent is not the one currently running, finish setup, then print the exact command to launch the other agent (do not try to start one interactive TUI inside another).

### Launching (bootstrap)
The first launch needs one working model. Create `bootstrap.sh` once, then use it for every project:
```bash
#!/usr/bin/env bash
# usage: ./bootstrap.sh aider|opencode [extra args]
set -a; . "${KEYS_PATH:-$HOME/Documents/Work/ai-toolkit/config/ai-keys.env}"; set +a
case "$1" in
  aider)    exec aider "${@:2}" ;;
  opencode) exec opencode "${@:2}" ;;
  *) echo "usage: $0 aider|opencode"; exit 1 ;;
esac
```
Gateway combos: start the gateway first (Step 2), then launch.

### Route replacement and failover (what happens when a route fails)

| Where | Trigger | Behavior |
|-------|---------|----------|
| OmniRoute | provider error, limit, or timeout | automatically tries the next provider in the combo |
| LiteLLM | error, 429, timeout | retries, then follows `fallbacks` in order |
| Agent (no gateway) | 429, 5xx, timeout | follows the agent rule below |

**Agent rule (when it must switch routes itself):**
1. Retry once after a short wait.
2. Switch to the next entry in `FALLBACK_ORDER` (e.g. `omniroute → openrouter → nim → groq`), using the wiring table to change base URL and model.
3. Tell the user in one line what was switched and why. Log it in the `PLAN.md` handoff.
4. Never switch silently to a paid or DeepSeek route unless `ALLOW_DEEPSEEK: true`. Never switch to a clearly weaker model in the middle of a BUILD task without telling the user.
5. If every route fails, go to the STOP & ESCALATE box (4A); do not loop.

**Switching combos mid-project:** when the user says "switch to <combo>", repeat Steps 1–5 for what changed only, then update the Control Panel and RUNBOOK. Project files stay the same, so no work is lost.

---

## 7. TEMPLATES

**BRIEF.md**
```
Project:
Problem / who it is for:
Must-have features (max 5):
Later:
Stack constraints:
Non-goals:
Data / integrations:
Security / privacy notes:
Success criteria:
```

**ARCHITECTURE.md skeleton** (max 1 page)
```
Stack:
Folder structure:
Modules (name: responsibility, public interface):
Data model:
Key decisions (and why):
Out of scope:
```

**PLAN.md task format**
```
- [ ] T<N> <goal>
      Files: <paths>
      Acceptance: <test or command that must pass>
```

**TESTPLAN.md / BUGS.md**
```
TESTPLAN:  - [ ] <feature>: <how to verify>  (auto | manual)
BUGS:      B<N> | <symptom> | <repro> | sev: high/med/low | status: open/fixed/deferred
```

**Task prompt**
```
Task T<N> from PLAN.md. Edit only: <files>. Out of scope: everything else.
Follow ARCHITECTURE.md. Add tests. No new dependencies.
Done when: <acceptance> passes. Output: minimal diff + 3-line summary.
```

**Bug prompt**
```
Bug B<N>: <symptom>. Expected: <x>. Repro: <steps/command>. Files: <paths>.
Tried: <what failed>. Write a failing test first, then the smallest fix, then rerun the suite.
```

**Session handoff** (append to `PLAN.md`)
```
Session: strategy / stack | Done | In progress | Next task | Gotchas or limits hit
```

---

## 8. AGENT CHECKLIST

Before a task: strategy, phase, and a working connection known · state reloaded per Resume protocol (1A) · task scoped to named files (≤3) · plan stated (approval if >3 files) · acceptance test defined.
Before finishing: tests, lint, and build run with results reported · diff minimal, no secrets or stray files · `PLAN.md`, `TESTPLAN.md`, `BUGS.md` updated · stop reason logged if halted (4A) · next task suggested · asked to continue at phase boundaries.
