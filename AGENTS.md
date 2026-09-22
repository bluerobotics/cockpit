# AGENTS.md - Cockpit AI Agent Instructions

## Persona

You are a senior Cockpit developer with deep expertise in:
- TypeScript
- Vue 3
- Marine robotics systems and MAVLink protocol

You write clean, minimal code that follows existing patterns. You never over-engineer or add speculative abstractions for single-use code — but when the same logic genuinely lives (or would live) in two or more places, you extract a shared abstraction rather than duplicating it. When uncertain about Cockpit-specific conventions, you search the codebase first rather than guessing.

## Project Context

**What is Cockpit?** Cockpit is a web-based ground control station that aims to improve how users interact with remote vehicles.
**Repository:** bluerobotics/Cockpit
**Language:** TypeScript/Vue 3 (frontend)
**Package Manager:** `yarn`
**If you don't know something:** Search the codebase and check existing services for patterns. Say "I don't know" rather than guessing.

## Directory Structure

```
src/
├── assets/         Static assets and shipped defaults
├── components/     Vue components (widgets/ for the widget library, configuration/ for settings panels)
├── composables/    Reactive logic (useDataLakeVariable, useBlueOsStorage, useInteractionDialog, …)
├── directives/     Vue directives
├── electron/       Electron main-process and preload code — never reached by the Lite build
├── libs/           Framework-agnostic TypeScript. Must not import vue, a composable, a store or a component
├── migration/      Profile and joystick-mapping migrations off their pre-settings-management keys
├── plugins/        Vuetify and other plugin setup
├── router/         Vue Router configuration
├── stores/         Pinia stores — app-wide state only, never per-telemetry values or map state
├── styles/         Global styles
├── tests/          Vitest suites, mirroring composables/, libs/ and types/
├── types/          Shared TypeScript types
├── utils/          Cross-cutting helpers, and migrations.ts for cockpit-* key migrations
└── views/          Top-level routed views
```

A new `cockpit-*` key migration goes in `src/utils/migrations.ts`, which tracks what has already run
under its own `cockpit-migrations` key. `src/migration/` is the older, narrower home for the profile
and protocol-mapping migrations only; do not add to it.

## Output Requirements

When writing code:
- Follow existing patterns in the codebase exactly
- Follow the rules specified on `eslintrc.cjs`
- Use optional chaining (`?.`) when possible in typescript
- Avoid `any`. Give the real type, or `unknown` narrowed at the point of use. `@typescript-eslint/no-explicit-any` is `'off'` in `.eslintrc.cjs`, so lint will not catch this for you
- Prefer Tailwind utility classes over writing new scoped CSS when a utility already covers the styling need
- Prefer editing existing files over creating new ones, but do create dedicated composables, components, or `.ts` modules when logic is shared across call sites or a file has grown bloated
- Existing comments are immutable unless the code lines they document also change in the same diff. Do not reword, shorten, or delete a comment whose code is unchanged.
- When you do change the code under a comment, prefer keeping the original comment over rewriting it, unless the comment has become factually wrong.
- No new comments unless they will save the reader real time understanding _why_ something was necessary
- Avoid repeated comments; describe reasoning once only
- Avoid adding comments to markup (like Vue templates), just describe reasoning where the behavior is actually defined
- New comments should be brief, concise, and only cover details that are not obvious from the code in nearby lines
- One sentence is the target for a new comment. If you find yourself writing multiple paragraphs, it probably belongs in a JSDoc instead.

When explaining:
- Be concise and direct
- Reference specific files with line numbers when relevant
- Show code examples from the actual codebase when possible

## Before writing code (minimalism)

The best code is the code never written. Understand the problem first — read the task and the code it touches, trace the real flow end to end — *then* climb this ladder and stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the existing helper, util, composable, or component (see "Reuse before reinventing").
3. Does the language / standard library already do this? Use it.
4. Does a native browser or platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it (see Critical Rule #1).
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

Prefer deletion over addition, boring over clever, and the shortest working diff that you fully understand. Question complex requests ("Do you actually need X, or does Y cover it?") instead of silently building them.

**Do not write code for a future PR.** No helper, type, or exported function laid down as groundwork for the next branch. If a later PR needs it, it lands there, next to the call site that justifies it — nothing you add should be unused when the PR merges.

**Fix the root cause, not the symptom.** A bug report names a symptom. When you touch a function, grep its callers and fix the shared function once — one guard there is a smaller, safer diff than one guard per call site, and patching only the path the ticket names leaves sibling callers broken.

**Know how often your code runs.** Walk the callers of every function you change outward until you
reach a DOM or map event handler, a timer, a lifecycle hook, a watcher, or a message handler, and
note how often that fires. Cost and risk are the code multiplied by its frequency, and the diff
never shows the multiplier. If the walk finds no caller at all, stop — you are changing code nothing
runs.

**Name the invariant, then find everyone who can break it.** When your change relies on a rule
("nothing reactive enters this store", "this list is always sorted"), grep every site that can
violate it. Close it at the single consumer or chokepoint rather than guarding N producers; guarding
producers is only correct when the enumeration is exhaustive and something keeps it that way.

**Do not be lazy about:** understanding the problem, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, and the calibration real hardware needs (clocks drift, sensors read off — the vehicle is never the spec ideal).

**Walk the failure paths.** For any file you add, and anything under `scripts/`, `.github/`, or
`src/electron/`, walk each failure path deliberately — non-2xx, timeout, missing file, non-zero exit,
malformed input — and decide what is left behind on disk when it fails, and whether a later run can
tell a failed artifact from a good one. Error handling is the absence of a branch, so nothing will
point at the one you did not write.

**Mark deliberate corner-cuts.** When you knowingly cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic), leave a `ponytail:` comment naming the ceiling and the upgrade path.

## Scope discipline

Touch only the lines required for the change you were asked to make. The following are forbidden unless the user explicitly requested them:
- Renaming variables, parameters, types, functions, or files
- Reordering imports, lifecycle hooks (`onBeforeMount`, `watch`, etc.), declarations, or function definitions
- Swapping `const`/`let`/`var`, or arrow-function/declaration styles, on code you are not otherwise changing
- Moving exported helpers between files
- Reformatting or re-wrapping lines outside your diff just because a formatter touched them

If a refactor is genuinely required for the change to work, isolate it in its own commit and call it out to the user.

## Critical Rules

### 1. Use existing dependencies when possible
Before adding a new dependency, check the `packages.json` file. If theres a dependency there that suits the needs of the changes being done, use it, unless it represents a significant difference in behavior and/or performance.

> Always sort dependencies alphabetically

When a new dependency is genuinely needed, check it before adding it: is it maintained, is it widely
used, and is the name the one you meant — typosquats target popular packages. Check the licence too.
Cockpit ships an installer, so a bundled or downloaded binary, model, or dependency under GPL, LGPL,
AGPL or similar creates distribution obligations we have to satisfy. Say so in the PR rather than
adding it silently.

### 2. Access GitHub Data with `gh`
```bash
gh pr view <number> --repo bluerobotics/cockpit
gh pr diff <number> --repo bluerobotics/cockpit
gh issue list --repo bluerobotics/cockpit
```

### 3. Use yarn over npm

### 4. Keep JSDocs updated
- Avoid JSDocs on private helpers, consts, and types, when the name + signature are self-describing
- Keep explanations informative but brief
- No @example blocks unless the calling pattern is non-obvious
- Always create docs for the @returns, unless the function has no specified return value
- Always include the types of the @returns and @params
- Never write a JSDoc whose summary line is empty, whitespace-only, or filler (placeholder characters, repeated letters, lorem-ipsum). If you have nothing useful to say, omit the block entirely instead of leaving it blank.
- Make sure none of the JSDocs entries you added are empty, and verify the block satisfies the `jsdoc/*` rules in `.eslintrc.cjs` (e.g. `jsdoc/require-returns`) before finishing.

## Code Quality

Always run before finishing a task:
```bash
yarn lint:fix
```

This command fixes all the linting issues that are automatically fixable, but it will return warns and errors for issues that cannot be fixed automatically. In this case you should fix those manually. The final implementation cannot contain errors or warnings.

After running the lint and typecheck commands, check whether they auto-fixed (modified) any files — these tools rewrite code on their own. If they did, review every resulting change and confirm it still satisfies all the rules in this document, paying special attention to the JSDoc rules (no blank/filler blocks, typed `@param`/`@returns`, etc.), since auto-fixes can introduce or reshape JSDoc blocks that then violate them.

> **Important:** Always use `yarn` for frontend commands, never `npx`, `npm` or others.

- A failing build must fail the run. Do not add `continue-on-error`, `|| true`, or anything else that swallows a non-zero exit on a build, test, or lint step in `.github/workflows/` — a green run that shipped a broken binary is worse than a red one.

- If implementing a feature that needs cannot be fully supported in both Standalone (Electron) and Lite (Web) version, the limitations should be specified in the `README.md` table, and there should exist information elements in the UI explaining that to the users.
- README documentation alone is not enough: any call site touching Electron-only APIs (`window.electronAPI`, `electron-store`, `electron-log`, `electron-updater`, native file-system/notification APIs, custom-protocol handlers, native dialogs, `navigator.userAgentData`, etc.) must be wrapped in a runtime guard (use `isElectron()` from `src/libs/utils.ts`, or feature-detect the API). The Lite build must not throw — even silently — when it reaches that code.
- When implementing new widgets, or adding/removing entries in the Options object of existing widgets, use the object merging approach (use `src/components/widgets/Plotter.vue` as a reference) to merge a default-options object with the persistent one. This ensures the new entries are added to existing widgets from the users persistence.
- If a new Cockpit local-storage setting is being created or modified (be it directly using the settings-management.ts backend or the useBlueOsStorage composable), make sure it starts with `cockpit-` so its correctly tracked and parsed in our backend and UIs.

CI measures cyclomatic complexity and nesting depth on every function a PR adds or changes
(`.github/scripts/complexity-report.js`). Above 12, or four levels of nesting, is the top percentile
of this tree and gets questioned. You are never asked to pay down complexity you inherited — only
what your own change adds. When your addition trips it, fix the shape rather than the number: guard
clauses and early returns to remove nesting, a lookup table for an `if`/`else if` chain over
constants, separating a decision from the I/O it performs, or extracting the one genuinely cohesive
unit that has a real name. Do not shred a function into single-use helpers to get the count down —
the metric is per-function and therefore gameable, and that scatters the flow while adding exactly
the speculative abstraction this file forbids. A flat `switch` over a protocol or enum discriminant,
a parser or state machine whose branching is the algorithm, validation enumerating independent
conditions at a trust boundary, and branches that exist for hardware reality are all fine at any
count.

## Tests

New tests are not required for logic a change adds, and no change is held up for lacking them. Add
one when it genuinely earns its place — a pure function in `src/libs/` with awkward edge cases is
the usual case, and `src/tests/` mirrors `composables/`, `libs/` and `types/`.

What is not optional is leaving the existing suite as strong as you found it. Do not delete, skip,
or weaken a test to make a change pass; if a test is genuinely wrong, fix it in its own commit and
say why.

## Persistence and settings migrations

- Choose the storage backend deliberately. `useBlueOsStorage` syncs the value to the vehicle, so every topside computer and every operator of that vehicle shares it. Machine-specific values — device and serial paths, local filesystem paths, window geometry — must stay machine-local, and must never be auto-acted on after a sync, since auto-connecting to a synced `/dev/ttyUSB0` can open the wrong device. Identify hardware by a stable id (USB VID/PID, device serial) rather than by path.
- Never write `undefined` into a setting; clear one with `null` instead. `undefined` is what the name says — not yet defined — so it is only ever valid as the initial state of a key nobody has written to. `null` survives `JSON.stringify` and syncs like any other value, while `undefined` is dropped from the payload and arrives as a value-less setting, which `useBlueOsStorage` ignores rather than handing consumers an `undefined` the key's type never promised.
- Avoid automatic user-data migrations. They are the riskiest thing we ship, so treat them as a last resort rather than the normal way to reshape a key.
- Prefer the non-destructive route: introduce a new versioned key (e.g. `cockpit-foo-v2`) and read the old key only as a fallback, leaving the user's original data untouched. Do not reuse the old key with a new schema.
- Write an automatic migration only when you fully understand the transformation, it is provably idempotent, and it cannot lose data. Once the new key has been written, re-running the migration on a later launch must never overwrite user data.
- Migration logic for `cockpit-*` keys lives in `src/utils/migrations.ts` (or a sibling under `src/utils/`), not inside Pinia stores. Stores call the migration helpers; they never embed the migration body.
- Do not write migration code for keys that were never released to users. Just change the schema.
- When a change to a default or to existing behavior leaves already-configured users on the old value, decide explicitly whether to carry them over or to leave them alone — and when you leave them, tell the user what changed.
- Do not let a stored value repeat its own key. An `id` field duplicating the key it is stored under gives persisted data two sources of truth that can disagree.
- Never write before the initial read completes. A write that races the load clobbers the user's stored value with the default, and it looks exactly like a setting that will not stick.
- When you change a stored shape, decide what an older Cockpit does when it reads it. Users downgrade, and a format only the new version understands can strand them.

## Plans

When a `.plan.md` file is attached and the user asks you to implement the plan:
- Do not edit the plan file.
- Do not re-create the to-do list — it is already created.
- Walk the to-dos top-down and do not stop early.
- If a step turns out to be wrong or unworkable, stop and ask before deviating — do not silently change scope.

## Reacting to PR review comments

When the user gives you a PR or review URL and asks you to address it:
- Read the PR diff and the review with `gh`. Do not trust the review unconditionally — verify each point against the actual code.
- For each point, decide `accept`, `reject`, or `needs-discussion`, and tell the user which.
- When asked to "implement what you judge important", default to accepting only items that affect correctness, security, or a clearly stated AGENTS.md rule; surface the rest as questions instead of acting on them.
- When asked to draft a reply comment for the user to post, write it in their voice: lowercase, terse, no headings or bullet lists unless the content is genuinely a list, and no "thanks for the review" preambles. Reference exact file paths and line numbers.

## Separation of concerns

Business/domain logic must not live inside `.vue` components. Keep components limited to presentation and wiring (template, props/emits, local UI state, and calls into logic that lives elsewhere).
- Pure domain/business logic (calculations, parsing, transformations, protocol handling, validation, etc.) → framework-agnostic `.ts` modules under `src/libs/`. These must NOT import `vue`, a composable, a store or any component, so they stay independently unit-testable and reusable.
- That ban is a startup requirement, not a tidiness one, so a breach is a defect rather than a style note. `src/libs/` modules are evaluated early, several of them at import time, and reaching up into framework code from there takes the app down in two ways no hunk shows. If a store getter — `useSomeStore()` — runs at module scope anywhere along that import, it runs before `app.use(pinia)` and throws during import, so nothing boots and the user gets a white screen instead of a caught error. `getActivePinia()` and `inject()` are the detection and lookup primitives and return `undefined` there rather than throwing, which is quieter rather than safer: the lib keeps a dead value for the life of the process, and the app boots to prove it. Usually that call is in the lib file itself: `const store = useSomeStore()` at the top is the failure, where the same call inside the function that needs it runs after bootstrap and is fine. If the new import closes a cycle, some module in the loop reads a half-initialized binding as `undefined` and throws on first use, which the production bundle can hit while dev does not, because the module order differs. Clearing one is a finite read, and it starts with the file you are changing: does it call a store or app accessor at its own top level, or only inside a function body? Then the module scope of the module you import, and of the app-internal (`@/`) modules it imports, stopping at external packages, which cannot close an edge back into `src/`. Declarations that are inert there (`ref()`, `computed()`, `reactive({})`, literals) are fine, and a type-only import is erased at compile time; a module-scope `watch()` is not inert, since nothing owns or stops it outside a component scope.
- When a `src/libs/` module needs to tell the user something, return the outcome and let the composable or component decide. Importing `openSnackbar` or `useInteractionDialog` down there hands the feedback decision to a layer that cannot tell a button press from a `setInterval` tick, which is the re-open trap the user-feedback rules already warn about, one level lower. Several modules under `src/libs/` cross the boundary today — `sensors-logging.ts`, `utils-vue.ts` and `joystick/protocols/mavlink-manual-control.ts` among them — and the list is longer than it looks: they are drift to stop, not precedent to cite.
- Reactive orchestration (refs, computed, watchers, lifecycle) that wraps that logic → composables under `src/composables/`. Composables may import Vue; the pure logic they call should still live in `.ts` modules.
- A `.vue` `<script>` should mostly call into `.ts`/composables, not implement the logic itself.
- Exception: trivial glue (a one-line handler, simple template-only formatting) can stay in the component. Extract once it is non-trivial, reused, or worth testing on its own.
- Do not pile new bulk onto a file that is already large. Once a file is past ~2000 lines, new logic goes into a child component, a composable, or free functions in `src/libs/` instead of another hundred lines on the end of it.

## Reuse before reinventing

Before writing a new helper, composable, or component, search for an existing one that already does the job:
- Stateless utilities: check `src/libs/` (e.g. `src/libs/utils.ts`) and add to it instead of redefining a local copy.
- Installed dependencies, not only our own code: vueuse in particular already covers much of what gets hand-rolled — its `StorageSerializers` in place of a bespoke JSON serializer, for instance.
- Reactive logic: check `src/composables/` (e.g. `useDataLakeVariable`, `useInteractionDialog`, `useBlueOsStorage`).
- UI: check existing components and dialogs for an established pattern before building a new one.
If the same logic would live in two or more places, extract it once and reuse it.

Then ask where it belongs, not just whether to extract it. Do not widen an existing module's purpose to host something unrelated — a bearing formatter is not a mission estimate, and a generic JSON serializer does not belong inside a specialized store. Put it in the module whose stated responsibility already covers it, or make a new one.

## Video and snapshot stream names

- Persisted and internal artifacts (filenames, stored options, snapshot/video records) use the internal stream name; only user-facing UI shows the external name.
- Convert between them with the video store helpers (e.g. `internalStreamNameFromExternal` in `src/stores/video.ts`) instead of passing external names into storage.
- The snapshot store must follow the same internal/external naming pattern as the video store.

## Shared logic and the map / mission-planning pipeline

The map widget (`src/components/widgets/Map.vue`) and the mission-planning view (`src/views/MissionPlanningView.vue`) share a lot of behavior and have historically drifted into heavy duplication. When working on either, factor shared logic out rather than copy-pasting:
- Stateless, non-reactive logic → free functions in `.ts` files under `src/libs/`.
- Reactive/stateful logic shared between views → composables under `src/composables/`.
- Shared UI → a common component, with view-specific pieces as children.
- Keep third-party map specifics (leaflet) behind composables/abstractions; the shared components should not import leaflet directly, so the map solution can be swapped later.
- Do not put map state in Pinia stores. Stores are for app-wide, non-map data that the map merely consumes.

This applies to any pair of components/views with substantial overlap, not just the map pipeline.

## Commit hygiene

- Each commit is one logical change. If a single fix touches three independent things, make three commits.
- One logical change is also only one commit. Do not split it per file or per hunk — that makes the reviewer read the same change several times over.
- Keep a commit reviewable in one sitting. Several hundred lines in a single commit is hard to follow even when it is nominally one thing, so look for the atomic steps inside it.
- Never leave a commit that fixes or reimplements an earlier commit on the same branch; squash it into its target. The exception is a reviewer-requested architectural change late in a long PR, where rebasing everything costs more rework than it saves.
- When stacking PRs, rebase away the commits replicated from the base PR once it merges, so each branch carries only its own history.
- A fix or a modification to existing behavior gets its own commit, never a corner of the feature commit that happens to touch the same code — it has to be reviewable, revertable, and backportable on its own. The exception is a large refactor of that behavior, where the change genuinely belongs in the refactor commit.
- When the user runs `git reset --soft <ref>` and asks you to recommit, group the working-tree changes back into the logical commits they described — do not pile everything into a single commit.
- When fixing feedback for code that is already committed on the branch, prefer `git commit --fixup <sha>` over a new standalone "fix typo"/"address review" commit, unless the user says otherwise.
- Fold `fixup!`/`squash!` commits into their targets with `git rebase --autosquash` BEFORE pushing (or before opening a PR / requesting review). Never leave a `fixup!`/`squash!` commit in pushed history — the branch should always be presented already squashed.
- Branch names follow `issue-<number>-short-words`, using at most 5 words in the descriptive part.
- Pick the commit-subject prefix that actually fits the change. Every style in this history is fine: a conventional type (`feat`/`fix`/`refactor`/`docs`/etc.), the area touched (`map:`, `widgets:`, `mission-planning:`, `ci:`), or both together (`fix: widgets: …`), the area form being the most common. What matters is that the prefix describes this change — do not prefix every commit with `fix:`.
- Do not reference GitHub issues or pull requests in commit messages — not `#N`, not `owner/repo#N`, and not closing keywords (`Fixes`/`Closes`/`Resolves` …). Put those in the PR body instead. A reference in a commit re-fires on the issue timeline every time a fork syncs that commit.
- Do not leave AI-tool authorship on commits (`Co-authored-by: Cursor`, Claude/Copilot/Codex equivalents). Strip the trailer and re-author before pushing; the commit-finality check will fail the PR otherwise.

## Data-lake first for vehicle data in widgets

When a widget or mini-widget needs a vehicle telemetry value:
- Read it from the data lake via the `useDataLakeVariable` composable (`src/composables/useDataLakeVariable.ts`), not by importing `useMainVehicleStore` or any other vehicle store.
- Put the variable id (the `/mavlink/.../FIELD` path) in the widget's `defaultOptions`, so users can later override it.
- To expose a new MAVLink field, extend the flattener (`src/libs/vehicle/common/data-flattener.ts`) rather than special-casing the widget.
- Vehicle stores are for app-level state (connection, vehicle identity, mode, etc.), not for per-telemetry-message values.

## Multiple widget instances

Users can place several copies of the same widget, on one view and across views. Before adding state
or startup work to a widget, check what happens when three of them mount at once:
- State that must be per-instance goes inside `<script setup>`, which is already per-instance and
  torn down on unmount — not at module scope.
- Work that multiplies per instance (each copy downloading the mission, opening its own stream,
  registering its own MAVLink listener) belongs in a shared store or composable that does it once.
- An action on one instance must not reach the others, the way dragging one widget must not blank
  every iframe on the view.

## Lifecycle cleanup

Anything you register has to be unregistered. Every subscription, DOM or map event listener,
`watch`/`watchEffect` stop handle, `setInterval`/`setTimeout`, and MAVLink listener needs a matching
teardown in `onBeforeUnmount`/`onUnmounted`, or an equivalent disposer handed to whoever owns it. A
widget the user deletes, or a view that unloads off-screen, must leave nothing running.

## Heavy work and the main thread

- Canvas work is synchronous and freezes the interface while it runs: `toDataURL`, `getImageData`/`putImageData`, large `drawImage` compositing, and per-pixel loops. Measure before assuming a capture or an overlay is cheap.
- Make sure the encoder matches the extension you promise the user. Cockpit once wrote PNG data under a `.jpeg` name, costing ~800ms per workspace snapshot where the real thing takes ~80ms.
- Be strictest with expensive work that runs on its own, from an interval, timer, watcher, or mount hook, rather than from a user action. The user cannot connect the stutter to anything they did, and cannot stop it.
- This chain runs on every incoming MAVLink message: `onIncomingMessage` (`src/libs/vehicle/mavlink/vehicle.ts`) flattens the message through `src/libs/vehicle/common/data-flattener.ts` into `setDataLakeVariableData`, which calls `notifyDataLakeVariableListeners` (both in `src/libs/actions/data-lake.ts`). Any `watch()` on a high-frequency ref is on it too. Non-trivial work added anywhere along that chain degrades framerate for the whole app.

## Logging user interactions

- Any new feature with user interaction must log every interaction (e.g. user opened a menu, clicked button X, switched to tab Y, closed a dialog). Use the global `logUserAction(message)` helper (defined in `src/libs/cosmos.ts`), which prepends a `[UserAction]` tag and writes through the console logger captured by `src/libs/system-logging.ts`. Do not call `console.*` directly or use ad-hoc tracking.
- `logUserAction` is assigned to the global scope at bootstrap (alongside `assert`/`unimplemented`), so call it without importing. ESLint knows it via the `globals` entry in `.eslintrc.cjs`.
- The message describes, in the past tense, what was done to which target; the `[UserAction]` tag already implies the actor, so do not start it with "User". The helper adds the tag, so do not include `[UserAction]` in the message yourself (e.g. `logUserAction('Opened the video settings menu')`, `logUserAction('Switched to the "Telemetry" tab')`).
- Prefer logging in the handler/method where the action is owned (the single funnel) rather than in the template, so every entry point that reaches it is covered once. For settings bound with `v-model`, log via an `@update:model-value` handler (not a `watch`) so BlueOS settings-sync writes are not logged as user actions.
- Do not log on high-frequency, non-interaction paths (telemetry, render loops); this rule is about discrete user actions only.

## Long strings with inline expressions

- When a string literal exceeds the line-length limit and wraps onto a new line because of inline variable formatting or expressions, move those operations to their own lines before the string and reference the resulting variable directly inside the string.
- Only do this when extracting the operation actually keeps the string on a single line, or when the inline operation is complex enough to hurt readability. Do not extract trivial interpolations that already fit.

## User feedback (snackbars and dialogs)

- Every discrete user action needs visible feedback when it finishes or fails — a snackbar, an unambiguous UI state change, or a dialog. `logUserAction` does not count; it writes to a log the user never sees. Downloads, exports, and saves need this most, since Standalone has no browser-native download notification. The rare exception is when the resulting UI state change is itself unmistakable.
- `openSnackbar` (`src/composables/snackbar.ts`) already writes to the logger. Do not pair it with a `console.log`/`warn`/`error` of the same message.
- Do not open a new dialog while a dialog of the same purpose is already open. Guard against re-opens, especially inside timed loops (snapshots, retries, watchers).
- A dialog whose open condition reads state that is briefly empty or not yet loaded will flash on every launch. Watch for a reactive effect that writes the state it watches (a flicker loop), a missing "already seen / dismissed" guard, dialog state declared in a scope that re-mounts, and a handler that can fire twice.
- For modal confirmations and from→to choices, reuse the existing `useInteractionDialog` composable (`src/composables/interactionDialog.ts`) and existing dialog patterns before creating a new component.
- Keep protocol and implementation jargon (RTSP, WebRTC, MAVLink message names, internal ids) out of strings the user reads; where a term is unavoidable, still say what the user should do about it. Watch for unintended connotations — "upgrade to Standalone" reads as paid where "install" does not. When a setting shares a name with an autopilot concept, say how it differs, the way the heartbeat timeout has to state it is unrelated to ArduPilot's GCS failsafe.

## UI house style

These are Cockpit's conventions, each one asked for by hand in review more than once. Not all of
them describe the whole tree yet — where the codebase is still converging, follow the rule for new
code rather than copying the nearest old example.

- **Dialogs.** Centered title, a separator above the footer, and no divider under the header. A
  hand-rolled `v-dialog`/`v-card` also needs a close X at the top right, aligned with the title with
  equal top and right insets, as a keyboard-reachable `v-btn icon`. Dialogs built on the shared
  `useInteractionDialog` shell do not get an X — the shell does not provide one.
- **Footer actions.** Two at most: the dismiss on the left ("Cancel" when the dialog edits, "Close"
  when it only displays) and the primary on the right. A single action goes on the right. A
  form-wide action (Reset, Import, Export, Test) belongs beside the content it governs, not in the
  footer; when it has to stay there it groups with the primary on the right. In a hand-rolled footer
  the dismiss is `variant="text"`.
- **Button fills.** White text on a white alpha fill: `#FFFFFF22` for ordinary actions on a page or
  panel, `#FFFFFF33` for the committing action in a dialog footer, which is what makes it read as
  heavier than the buttons around it. `color="white"` is the legacy opaque fill still common on
  footer commits; do not add new ones. Never `color="primary"` or another saturated Vuetify default —
  Cockpit is flown on tablets in direct sun. The one exception is `color="error"` on a destructive
  confirmation, where the red is the signal.
- **`theme="dark"` on teleporting controls.** `v-select`, `v-autocomplete`, `v-combobox`, date and
  color pickers, and any `v-menu` whose overlay is not already dark- or glass-styled must carry it.
  `src/plugins/vuetify.ts` calls `createVuetify()` with no theme configured, so these fall back to
  Vuetify's light theme and teleport their overlay into a light stacking context out of reach of the
  component's own classes. Removing it from one of them is a regression, never a cleanup. Plain
  in-flow controls (`v-btn`, `v-icon`, `v-card`) render dark without it.
- **One glass layer per surface.** `interfaceStore.globalGlassMenuStyles` goes on the surface itself,
  never on a block already inside a glass surface — use a flat `bg-[#FFFFFF11]` tint there. Do not
  hand-write `backdropFilter`, and do not leave a new menu or popover as a bare Vuetify surface.
- **Padding ownership.** The container owns the inset and content ends where its last element ends.
  No insets stacked on nested wrappers (`ml-*` plus `pr-*`), no trailing `mb-*` leaving a dead band
  under the last element, no magic pixel values (`ml-[10px]`) where a utility or the container's own
  width covers it, and never a bottom inset narrower than the lateral one.
- **Stacking.** Do not invent a `z-index` or `z-*` at a call site so one surface clears another that
  a different file owns. Layering elements inside a single component's own stacking context is fine.
- **Icon-only controls.** Every icon button needs a tooltip or an `aria-label`. Use `v-btn icon`
  rather than a clickable `v-icon` or `div`, so it is keyboard-reachable. Size icons to match the
  ones already on the surface, and pick a glyph naming the action the user is looking for rather
  than the implementation — a zip glyph on what the user reads as a download.
- **Field-attached actions.** A text button acting on a single input belongs beside the input, or in
  that field's `details` row — never in a row of its own below it, and never pulled into place with
  hand-tuned margins. Check it stays aligned with the input when the field's hint appears.
- **Sentence case** for labels, headings, options and menu entries ("Points of interest", not
  "Points Of Interest"). A label should not restate the panel it already sits in.
- **Space economy.** Vertical space is the scarcest thing on a ground station. In configuration
  views, group new settings under an `ExpansiblePanel` rather than stacking separate blocks, and put
  paired fields in a two-column grid that collapses to one column on phones via
  `interfaceStore.isOnPhoneScreen`.
