# Release tests

Scripted end-to-end checks for the release checklist. Each case drives a real Cockpit the way an
operator would — a visible cursor moving, clicking and dragging through the actual UI — against a
live (simulated) vehicle, and records the run to an mp4 with every check shown on screen as it
passes or fails. The video is the proof; `results.json` is the summary.

## Requirements

- Google Chrome (`/Applications/Google Chrome.app` on macOS, `google-chrome` elsewhere), `ffmpeg`
  and `curl` on `PATH`, Node 18+.
- A running Cockpit build: `yarn build && yarn preview` (port 5050), or any deployed build. Not
  `yarn dev`: its file watcher reloads the page under test whenever a file in the checkout changes,
  the run's own report included.
- A BlueOS running ArduPilot SITL, such as the container `e2e/ci/blueos-sitl.mjs` sets up (see
  `.github/workflows/release-tests.yml`). The runner force-disarms the vehicle and wipes its mission and
  fence before every case, so it refuses any target that is not a simulator.

## Running

```bash
node e2e/run.mjs MP- --vehicle localhost                # a group prefix
node e2e/run.mjs POI-12.1 MP-01.1 --vehicle localhost   # single cases
node e2e/run.mjs MP- --url http://localhost:5050 --vehicle localhost --headed
```

`--url` and `--vehicle` default to `$COCKPIT_E2E_URL` and `$COCKPIT_E2E_VEHICLE`; the vehicle has no
other default. `--build` labels the
run (defaults to `git describe`). Output lands in `e2e/output/<timestamp>/` (`--out DIR` puts the run
folder under DIR instead, to keep one batch apart from the others): one mp4 per case,
`results.json`, and `index.html` with each video next to its checks; clicking a check seeks the video
to it. The report is rewritten after every case, so an interrupted run still shows what it got
through.

The exit code is non-zero when any case fails.

## How a run stays clean

- Cockpit runs as the user `release-tests`, so the operators' own settings synced to the vehicle are
  never touched.
- Before each case the runner disarms the simulator, sets HOLD, clears its mission, and replaces every
  synced setting of the test user on the vehicle with a known package: the boat defaults in
  `fixtures/boat-defaults.json` (the layout and joystick mapping Cockpit imports for a boat), an empty
  mission, POIs and fence, and whatever the case lists in `meta.synced`. The fresh browser profile is
  seeded with the same package, so Cockpit opens on it and its first sync has nothing to change.
- Each case gets its own throwaway browser profile.

## Writing a case

`e2e/cases.csv` holds the checklist broken into sub-tests, with the steps and the pass criteria
for each. A case is `e2e/cases/<ID>.mjs`:

```js
export const meta = { title: 'Create a POI in mission planning', route: '/mission-planning', needs: ['vehicle'] }

export async function setup(ctx) {} // optional, runs before recording starts

export default async function run({ page, vehicle }) {
  await page.caption('Right-click where the point of interest goes')
  await page.rightClick(target)
  await page.check('One point of interest on the map', async () => ({ ok: n === 1, detail: `${n} on the map` }))
}
```

- `page` (`lib/driver.mjs`): `click`, `rightClick`, `dblClick`, `drag`, `hover`, `key('Meta+z')`,
  `type`, `fill`, `caption`, `check`, `waitFor`, `store(id, expr)` to read a Pinia store, and
  `timelapse(ms)` for long waits that should not make a long video. Targets are a CSS selector,
  `text=Label`, or a `{x, y}` point.
- `vehicle` (`lib/vehicle.mjs`): reads and sends MAVLink through BlueOS's mavlink2rest, independently
  of Cockpit. Use it to prove that the vehicle really got what the UI claims (`readMission()`,
  `read('VFR_HUD')`).
- `lib/cockpit.mjs`: map helpers (`geoToPage`, `pageToGeo`, `mapPoint`, `wheelZoom`, `poiMarkers`,
  `mapPolylines`), `missionState`, `drawSimplePath`, `fieldByLabel`.

Rules of thumb:

- Every case ends with at least one `check`; a case with none fails.
- A case that only applies to one build sets `meta.platforms` to `['electron']` (Standalone, run with
  `--app`) or `['web']`; the runner skips it on the other one.
- A case that measures the machine itself, like CPU use, sets `meta.hardware`; the runner skips it on CI, whose
  runners draw in software on shared cores.
- Check the state behind what is shown, not only that some text appears somewhere on the page.
- Find what you click by an `id` (or, on a reused component, a named class) that describes the element, not by
  its text (translated, and shared by other elements) or a styling class. When the element has none, add one to
  the component, named for what it is rather than for the test, so the app can use it too.
- When Cockpit is wrong, let the case fail with the video. Do not script around a product bug.
- Build preconditions through the UI in `setup`, with the same helpers the cases use, rather than
  writing Cockpit's internal storage formats by hand. The runner's seeding of the test user is the one
  exception, and it follows the shapes in `src/types/settings-management.ts`.
- Look at the frames before trusting a new case:
  `ffmpeg -i e2e/output/<run>/<ID>.mp4 -vf fps=1/3,scale=800:-1 /tmp/frames/%02d.jpg`.

## Running on another machine (`--remote`)

Performance only means something on the hardware operators have, so a Standalone build on a separate
Windows machine can be driven from here. That machine runs only Cockpit; the runner, the vehicle
checks and the video encoding stay on this one.

```bash
node e2e/run.mjs PERF- --remote <ssh-host> --app 'C:\path\to\Cockpit-1.19.0\Cockpit.exe' --vehicle <vehicle>
```

- The machine needs OpenSSH server, key login for `<ssh-host>`, and an unpacked Cockpit build. An
  installer unpacks with the built-in `tar -xf Cockpit-win-x64-<version>.exe -C <folder>`, which leaves
  any installed Cockpit alone. The build is labelled by its folder name.
- Apps started over ssh land in a session with no desktop, where Chromium composites in software at
  about twice the cost. Cockpit is started instead by a scheduled task on the logged-in desktop. Set it
  up once, in PowerShell on that machine, with a user logged in:

  ```powershell
  New-Item -ItemType Directory -Force "$env:USERPROFILE\e2e\profiles" | Out-Null
  Copy-Item e2e\remote\launch.ps1 "$env:USERPROFILE\e2e\launch.ps1"
  $a = New-ScheduledTaskAction -Execute powershell.exe -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $env:USERPROFILE\e2e\launch.ps1"
  $p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
  Register-ScheduledTask -TaskName E2ELaunch -Action $a -Principal $p -Force
  ```

- Each case gets a throwaway profile under `%USERPROFILE%\e2e\profiles`, removed when it ends; the
  DevTools port is forwarded over ssh. `download` and `chooseFiles` take paths on this machine, so cases
  that use them do not run remotely yet.

## Performance cases

`PERF-*` cases (`meta.perf: true`) measure as they record. The page keeps a timestamp per animation
frame, every long task and every trusted input from the start of the case; `measure(page, label, fn)`
marks a window, and the numbers are cut from that one series afterwards (`lib/perf.mjs`):

- **fps** is frames over wall time, never the mean of 1000/dt, which hides a freeze among fast frames;
- **frame p95 / worst frame**, and **stalled ms**: time lost in frames over 50 ms, what feels like sticking;
- **long tasks**, and **response**: from an input to the first frame after the map's own move/zoom event.

Gestures go out at a fixed pace without waiting for the app (`wheelNotches`, `dragSteady`), so a slow
build gets the same input as a fast one. Each case checks that the input really reached the page:
the wheel's total scroll, since Chromium merges wheel events when the page is busy, as it does for a
real mouse.

Recording is not free on a weak machine. The screencast reads every frame back from the GPU and
encodes it on the CPU the app is using, which on a J4125 took Cockpit at rest from 60 fps to 34
(40 at `--capture 800x60`), and capped how much work it did while panning so a recorded pan looked
smoother than an unrecorded one. So:

```bash
node e2e/run.mjs PERF- --arms recorded,bare --reps 3 --capture 800x60 ...
```

runs every case once per arm per repetition, alternating the order. **Quote numbers from `bare`**, the
same script with no screencast and nothing painted over the page; watch `recorded`. Each recorded video
gets a frame-rate plot burned in afterwards, drawn on this machine from the page's own timings
(`lib/perf-video.mjs`), and the report shows median and range per window and arm. `<case>.perf.json`
keeps the raw series.

### Recording through an HDMI capture card (`--hdmi`)

A capture card plugged into the measured machine's HDMI output, and into this one over USB, records what
its screen shows at no cost to it, so the recorded run is the measured run and one arm is enough:

```bash
ffmpeg -f avfoundation -list_devices true -i ""          # find the card's name
node e2e/run.mjs PERF- --arms recorded --reps 3 --hdmi "USB3 Video" --hdmi-mode 1920x1080@60 --remote <host> ...
```

- Nothing is painted inside the page under test. The cursor, clicks, keys, checks, captions and cards are
  logged while the case runs and drawn onto the video afterwards (`lib/overlay-burn.mjs`): the same
  overlay script replayed in a transparent headless page on this machine and laid over the capture where
  the app sat. Measured with the overlays still in the page, a recorded run was not the unrecorded one;
  with them drawn afterwards, PERF-02 recorded and bare matched over three runs each.
- The measured gestures play on the measured machine (`remote/gestures.mjs`, copied there on every start),
  through the app's local debugging port, and mark the measured window themselves. Sent from this machine,
  every notch and drag step crossed the ssh tunnel, and windows came out 0.4 to 1.4 s longer than planned
  with that much quiet time inflating their frame rates differently on every run.

- The card acts as the machine's monitor; none is needed. Set Windows to 1920×1080 at 60 Hz on it, and
  check again after a reboot or replug: the card in use (it lists as `USB3 Video`) advertises 3840×2160 at
  30 Hz as its preferred mode, which Windows picks on its own. At 30 Hz every run is capped near 30 fps
  and the app gets a larger viewport, so those numbers mean nothing. Check with
  `Get-CimInstance Win32_VideoController` (CurrentRefreshRate) and fix it in Windows' display settings
  (Display → Advanced display → refresh rate) on the machine itself.
- With `--hdmi`, every arm runs maximised, without the fixed 1600×1000 viewport, so the video shows the
  app filling the screen and the arms stay comparable. Results record the viewport each run had.
- The page turns white for 0.4 s at the start and the end of each recording. Those two flashes place the
  video on the page's clock, which the frame-rate plot needs; the runner warns when the capture misses
  one (the app not filling the captured screen, or a card that drops frames).
- Check a card before trusting it: many USB cards advertise 1080p60 and deliver 30, or 60 as heavy MJPEG,
  which hides exactly the frames a stall drops. `node e2e/lib/hdmi.mjs` checks the flash maths.
  `USB3 Video` delivers 1920×1080 at a steady 60 fps (raw UYVY), and recorded PERF-02 runs matched bare
  ones, so with it the video costs the measured machine nothing.

## macOS note

macOS gates local-network access per app. A process started from a terminal without that
permission gets "host unreachable" for the vehicle even though `ping` works. The driver therefore
opens Chrome through LaunchServices, so Chrome's own permission applies, and the vehicle helpers use
the system `curl`, which is exempt.
