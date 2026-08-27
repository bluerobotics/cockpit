# Third-party software

Cockpit includes software developed by third parties. The following notices apply to components
distributed with Cockpit. They are not relicensed under either arm of Cockpit's dual-license offer (see
[LICENSE.md](LICENSE.md)); each one stays under the license named below.

"Standalone" is the Electron desktop application. "Lite" is the browser build, also shipped as the BlueOS
extension. Components that only run on a developer machine (build tooling, test runners, linters) are not
listed here; they are distributed with neither build, so the policy gate described under
[The rest of the npm tree](#the-rest-of-the-npm-tree) reports on them but does not fail on them.

This file is distributed with both builds and readable inside the running application, under
"Third-party software" in the About dialog. Standalone additionally carries it as a file in the
application's resources.

## Contents

- [Overview](#overview)
- [Bundled binaries](#bundled-binaries) — FFmpeg, Piper, go2rtc, SDL
- [Source code for the GPL components](#source-code-for-the-gpl-components)
- [Application runtime](#application-runtime) — Electron, native modules, WebAssembly
- [Fonts and icons](#fonts-and-icons)
- [Libraries with additional terms](#libraries-with-additional-terms)
- [Permissive npm libraries](#permissive-npm-libraries)
- [Map tile services](#map-tile-services)
- [The rest of the npm tree](#the-rest-of-the-npm-tree)

---

## Overview

| Component | Version | License | Distributed with Cockpit | Source |
| --- | --- | --- | --- | --- |
| FFmpeg (Windows, Linux) | 7.1 (`n7.1-214-g71889a8437`, `gpl` variant) | GPL-3.0-or-later | Standalone | [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) |
| FFmpeg (macOS) | 7.1 (`--enable-gpl`, no `--enable-version3`) | GPL-2.0-or-later | Standalone | [osxexperts.net](https://www.osxexperts.net/) builds of [FFmpeg](https://git.ffmpeg.org/ffmpeg.git) |
| Piper runtime (Windows, Linux, macOS x64) | 2023.11.14-2 | MIT, distributed as a GPL-3.0-or-later binary because it links espeak-ng | Standalone | [rhasspy/piper](https://github.com/rhasspy/piper) |
| Piper runtime (macOS arm64) | v1.6.0, compiled by `yarn build:piper` | GPL-3.0 | Standalone | [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) |
| espeak-ng (inside the Piper runtime, with `espeak-ng-data`) | as shipped/built with Piper above | GPL-3.0-or-later | Standalone | [espeak-ng/espeak-ng](https://github.com/espeak-ng/espeak-ng) |
| ONNX Runtime (inside the Piper runtime) | as shipped/built with Piper above | MIT | Standalone | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |
| Piper voice model `en_US-amy-low` | from `main` of the voices repository | MIT, as declared by the voices repository | Standalone | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) |
| go2rtc | 1.9.14 | MIT | Standalone | [AlexxIT/go2rtc](https://github.com/AlexxIT/go2rtc) |
| SDL2 (native library loaded by the joystick bindings) | 2.32.8 | Zlib | Standalone | [libsdl-org/SDL](https://github.com/libsdl-org/SDL), built by [kmamal/build-sdl](https://github.com/kmamal/build-sdl) |
| `@kmamal/sdl` (Blue Robotics fork of node-sdl) | 0.11.13-rawaxis.1 | MIT (upstream notice preserved) | Standalone | [rafaellehmkuhl/node-sdl](https://github.com/rafaellehmkuhl/node-sdl), forked from [kmamal/node-sdl](https://github.com/kmamal/node-sdl) |
| Electron (with Chromium, Node.js and V8) | 29.4.6 | MIT, plus the licenses in `LICENSES.chromium.html` | Standalone | [electron/electron](https://github.com/electron/electron) |
| `serialport`, `@serialport/bindings-cpp` | 13.x, 13.0.0 | MIT | Standalone | [serialport/node-serialport](https://github.com/serialport/node-serialport) |
| Font Awesome Free icons | 6.7.2 | CC-BY-4.0 (icon artwork) AND MIT (code) | Standalone, Lite | [FortAwesome/Font-Awesome](https://github.com/FortAwesome/Font-Awesome) |
| Material Design Icons webfont | 7.4.47 | Apache-2.0 (icons, fonts) AND MIT (code) | Standalone, Lite | [Templarian/MaterialDesign-Webfont](https://github.com/Templarian/MaterialDesign-Webfont) |
| GSAP | 3.13.0 | GreenSock Standard "no charge" License | Standalone, Lite | [greensock/GSAP](https://github.com/greensock/GSAP) |
| Leaflet | 1.9.3 | BSD-2-Clause | Standalone, Lite | [Leaflet/Leaflet](https://github.com/Leaflet/Leaflet) |
| leaflet-edgebuffer | 1.0.7 | MIT | Standalone, Lite | [TolonUK/Leaflet.EdgeBuffer](https://github.com/TolonUK/Leaflet.EdgeBuffer) |
| leaflet.offline | 3.1.0 | LGPL-3.0 | Standalone, Lite | [allartk/leaflet.offline](https://github.com/allartk/leaflet.offline) |
| MarchingSquaresJS (via `@turf/turf`) | 1.3.3 | AGPL-3.0, with an additional permission for unmodified versions | Standalone | [RaumZeit/MarchingSquares.js](https://github.com/RaumZeit/MarchingSquares.js) |
| `jsts`, `@turf/jsts` (via `@turf/turf`) | 2.7.1, 2.7.2 | EDL-1.0 OR EPL-1.0 | Standalone, Lite | [bjornharrtell/jsts](https://github.com/bjornharrtell/jsts) |
| Monaco Editor | 0.52.2 | MIT | Standalone, Lite | [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor) |
| `posthog-js` | 1.253.4 | Apache-2.0 | Standalone, Lite | [PostHog/posthog-js](https://github.com/PostHog/posthog-js) |
| Roboto (loaded at runtime from Google Fonts) | served by Google Fonts | Apache-2.0 | Neither — fetched at runtime, not bundled | [googlefonts/roboto](https://github.com/googlefonts/roboto) |

Every other bundled npm package is under a permissive license; see
[Permissive npm libraries](#permissive-npm-libraries) and
[The rest of the npm tree](#the-rest-of-the-npm-tree).

Cockpit also loads map tiles from third-party services at runtime (OpenStreetMap, Esri World Imagery,
OpenSeaMap and GEBCO). No tile imagery is redistributed with Cockpit, and each layer carries its
provider's attribution on the map. See [Map tile services](#map-tile-services).

---

## Bundled binaries

These are not npm packages. They are fetched by `yarn postinstall` (`scripts/download-ffmpeg.js`,
`scripts/download-go2rtc.js`, `scripts/download-piper.js`) or compiled locally (`yarn build:piper`) into
`binaries/`, and copied into the Standalone application by the `extraResources` entries in
`package.json`. They are spawned as separate processes; Cockpit does not link against them.

### FFmpeg

Cockpit ships a different FFmpeg build per platform, and the two builds are under different versions of
the GPL because they were configured differently upstream.

| Platform | Build | Configuration | License |
| --- | --- | --- | --- |
| Windows, Linux | `ffmpeg-n7.1-214-g71889a8437-*-gpl-7.1` | `--enable-gpl --enable-version3` | GPL-3.0-or-later |
| macOS | `ffmpeg71arm` / `ffmpeg71intel` (7.1) | `--enable-gpl`, without `--enable-version3` | GPL-2.0-or-later |

- Version: 7.1
- Source: <https://git.ffmpeg.org/ffmpeg.git>. Windows and Linux builds come from
  [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) (`gpl` variant); macOS builds come from
  <https://www.osxexperts.net/>.
- Notice: FFmpeg is copyright of the FFmpeg developers. Neither build enables `--enable-nonfree`, so both
  are redistributable. Both include GPL-only components (`libx264`, `libx265`, `postproc`, and on macOS
  also `libvidstab` and `libkvazaar`).

The macOS builds report `ffmpeg version 7.1` with no git revision, so they come from the 7.1 release
tarball rather than from a snapshot. Their corresponding source is therefore
<https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz>, configured as the binary itself reports:

```
--prefix=/Volumes/tempdisk/sw --extra-cflags=-fno-stack-check --arch=arm64 --cc=/usr/bin/clang
--enable-gpl --enable-libvmaf --enable-libopenjpeg --enable-libopus --enable-libmp3lame
--enable-libx264 --enable-libx265 --enable-libvpx --enable-libwebp --enable-libass
--enable-libfreetype --enable-fontconfig --enable-libtheora --enable-libvorbis --enable-libsnappy
--enable-libaom --enable-libvidstab --enable-libzimg --enable-libsvtav1 --enable-libharfbuzz
--enable-libkvazaar --pkg-config-flags=--static --enable-ffplay --enable-postproc --enable-neon
--enable-runtime-cpudetect --disable-indev=qtkit --disable-indev=x11grab_xcb
```

That is the Apple Silicon build, read back from the binary itself. The Intel build is configured
equivalently but not identically, since flags like `--arch` and `--enable-neon` are architecture-specific.
Run `ffmpeg -version` against the copy inside a Cockpit installation to read the exact configuration of the
build you have.

### Piper

Piper is the offline speech synthesizer behind Cockpit's voice alerts. The runtime is prebuilt upstream on
every platform except macOS on Apple Silicon, which has no usable prebuilt release and compiles its own
from a different, GPL-3.0 upstream.

| Platform | Origin | License |
| --- | --- | --- |
| Windows, Linux, macOS x64 | [rhasspy/piper](https://github.com/rhasspy/piper) release `2023.11.14-2` | MIT for Piper's own code; the shipped binary links espeak-ng, so the binary as distributed is GPL-3.0-or-later |
| macOS arm64 | [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) `v1.6.0`, compiled by `yarn build:piper` | GPL-3.0 |

Notice for `rhasspy/piper`:

```
MIT License

Copyright (c) 2022 Michael Hansen
```

The runtime directory also carries these components, shipped inside or beside the Piper binary:

| Component | License | Source |
| --- | --- | --- |
| espeak-ng, with its `espeak-ng-data` phoneme data | GPL-3.0-or-later | [espeak-ng/espeak-ng](https://github.com/espeak-ng/espeak-ng) |
| piper-phonemize | MIT | [rhasspy/piper-phonemize](https://github.com/rhasspy/piper-phonemize) |
| ONNX Runtime | MIT | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

espeak-ng is the reason the distributed Piper binary is GPL-3.0-or-later on every platform, including the
ones where Piper's own source is MIT.

### Piper voice model `en_US-amy-low`

- Version: fetched from `main` of the voices repository.
- License: MIT, as declared by the voices repository.
- Source: <https://huggingface.co/rhasspy/piper-voices>, path `en/en_US/amy/low/`.

### go2rtc

- Version: 1.9.14
- License: MIT
- Source: <https://github.com/AlexxIT/go2rtc>
- Notice:

```
MIT License

Copyright (c) 2022 Alexey Khit
```

### SDL2

SDL2 is a native shared library, distributed alongside the `sdl.node` addon inside the `@kmamal/sdl`
package (see [Application runtime](#application-runtime)). It is a separate work from the Node.js
bindings that load it, and has its own license.

- Version: 2.32.8
- License: Zlib
- Source: <https://github.com/libsdl-org/SDL>. The binaries are produced by
  [kmamal/build-sdl](https://github.com/kmamal/build-sdl) (build scripts, MIT) and published as release
  assets there.
- Notice:

```
Copyright (C) 1997-2025 Sam Lantinga <slouken@libsdl.org>

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

---

## Source code for the GPL components

The Standalone application distributes binaries under the GPL, which obliges Blue Robotics to convey their
corresponding source or to give directions to it. This section is that offer. It covers FFmpeg, the Piper
runtime, and the espeak-ng inside Piper; go2rtc (MIT) and SDL2 (Zlib) carry no such obligation.

Blue Robotics distributes all of these unmodified, so the corresponding source is the pristine upstream
release in each case:

| Binary | License | Corresponding source |
| --- | --- | --- |
| FFmpeg (Windows, Linux) | GPL-3.0-or-later | Commit `71889a8437` of <https://git.ffmpeg.org/ffmpeg.git>, tagged `n7.1-214-g71889a8437`, with the build recipe at [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) |
| FFmpeg (macOS) | GPL-2.0-or-later | <https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz>, with the configure line recorded under [FFmpeg](#ffmpeg) |
| Piper runtime (Windows, Linux, macOS x64) | GPL-3.0-or-later as distributed | Release `2023.11.14-2` of <https://github.com/rhasspy/piper> |
| Piper runtime (macOS arm64) | GPL-3.0 | Tag `v1.6.0` of <https://github.com/OHF-Voice/piper1-gpl>, built by `scripts/build-piper-macos-arm64.js` in this repository |
| espeak-ng (inside every Piper runtime) | GPL-3.0-or-later | <https://github.com/espeak-ng/espeak-ng>, at the revision the Piper release above vendors |

For at least three years from the date you received a Cockpit release, and independently of whether those
upstream URLs remain reachable, Blue Robotics will send you a copy of the complete corresponding source for
the GPL binaries in that release, on a physical medium or by download, for no more than the cost of
performing the distribution. Write to software@bluerobotics.com naming the Cockpit version and platform.

None of this changes the licensing of Cockpit itself. These binaries are spawned as separate processes and
Cockpit does not link against them, so they are aggregated with Cockpit rather than combined into it.

---

## Application runtime

### Electron, with Chromium, Node.js and V8

- Version: 29.4.6
- License: MIT for Electron itself. Chromium, Node.js, V8 and their dependencies keep their own licenses,
  collected upstream in `LICENSES.chromium.html`.
- Source: <https://github.com/electron/electron>
- Notice:

```
Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.
```

Both files travel with every Standalone build, in a place that depends on the platform. On Windows and Linux
electron-builder leaves them beside the executable, renaming Electron's `LICENSE` to `LICENSE.electron.txt`;
on macOS the packaged artifact is the `.app` alone, so the `build.mac.extraResources` entries in
`package.json` copy both into its resources instead.
`LICENSES.chromium.html` is Electron's own notice file for Chromium and its dependencies, and ships as-is;
Cockpit does not enumerate those dependencies here.

### `@kmamal/sdl` — Blue Robotics fork of node-sdl

Cockpit reads joysticks through a Blue Robotics fork of node-sdl, pinned to a commit rather than to a
registry version, because it adds raw-axis support that upstream does not have.

- Version: 0.11.13-rawaxis.1, from `github:rafaellehmkuhl/node-sdl#dd1b97aa75bb84a2c899be40b0c48fcb135a4f88`
- Upstream: [kmamal/node-sdl](https://github.com/kmamal/node-sdl), MIT
- License: MIT. The fork preserves upstream's `LICENSE` file and its copyright line verbatim, and keeps
  `"license": "MIT"` in `package.json`.
- Notice:

```
Copyright (c) 2021 Konstantin M
```

The package's `install` script downloads a prebuilt `sdl.node` plus the SDL2 shared library from the
fork's own GitHub releases. Both are distributed with the Standalone application. The SDL2 library itself
is covered under [Bundled binaries](#bundled-binaries).

### Rust crates inside `mavlink2rest-wasm`

`mavlink2rest-wasm` is developed by Blue Robotics and is not third-party software, but the WebAssembly
binary it ships statically links third-party Rust crates, which are. They are identified from the build
paths recorded in the blob:

| Crate | Version | License |
| --- | --- | --- |
| `mavlink` (rust-mavlink, `ardupilotmega` dialect) | 0.16.1 | MIT OR Apache-2.0 |
| `wasm-bindgen` | 0.2.100 | MIT OR Apache-2.0 |
| `js-sys` | 0.3.77 | MIT OR Apache-2.0 |
| `serde` | 1.0.219 | MIT OR Apache-2.0 |
| `serde_json` | 1.0.140 | MIT OR Apache-2.0 |
| `json5` | 0.4.1 | ISC |
| `pest` | 2.8.0 | MIT OR Apache-2.0 |
| `ucd-trie` | 0.1.7 | MIT OR Apache-2.0 |
| `bytes` | 1.10.1 | MIT |
| `once_cell` | 1.21.3 | MIT OR Apache-2.0 |
| `crc-any` | 2.5.0 | MIT |

### `serialport` and `@serialport/bindings-cpp`

- Versions: `serialport` 13.x, `@serialport/bindings-cpp` 13.0.0
- License: MIT
- Source: <https://github.com/serialport/node-serialport>
- Distributed with Standalone as a native addon, for serial GNSS receivers and serial MAVLink links.

---

## Fonts and icons

Icon and font licensing is deliberately split out from library licensing here, because for these packages
the artwork and the code that draws it are under different terms.

### Font Awesome Free 6.7.2

Cockpit imports the SVG icon packages (`@fortawesome/free-solid-svg-icons`,
`@fortawesome/free-regular-svg-icons`) and the Vue integration, so the icon artwork and the integration
code both ship. Cockpit does not use Font Awesome's webfonts.

- Icon artwork: **CC-BY-4.0**, which requires attribution to Font Awesome when the icons are redistributed.
- Code (`@fortawesome/fontawesome-svg-core`, `@fortawesome/vue-fontawesome`, and the JS in the icon
  packages): MIT.
- Webfont files: none ship. The `Fonts: SIL OFL 1.1` line in the notice below is Font Awesome's standard
  wording; the SVG icon packages Cockpit installs carry no font files at all.
- Source: <https://github.com/FortAwesome/Font-Awesome>
- Notice:

```
Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
Copyright 2024 Fonticons, Inc.
Icons: CC BY 4.0 License (https://creativecommons.org/licenses/by/4.0/)
Fonts: SIL OFL 1.1 License (https://scripts.sil.org/OFL)
Code: MIT License (https://opensource.org/licenses/MIT)
```

### Material Design Icons webfont 7.4.47

`@mdi/font` is Cockpit's primary icon set; its CSS and webfont files are bundled by
`src/plugins/vuetify.ts`. The package's `LICENSE` is the "Pictogrammers Free License", which resolves to
Apache-2.0 for the icons and the fonts, and MIT for everything else.

- License: Apache-2.0 (icons and fonts) AND MIT (code)
- Source: <https://github.com/Templarian/MaterialDesign-Webfont>, artwork from
  <https://pictogrammers.com/>

### Roboto

Roboto is **not** bundled. `src/plugins/webfontloader.ts` fetches it from Google Fonts at runtime, so
Cockpit redistributes no Roboto font files and carries no notice obligation for them. The `roboto-fontface`
package (0.10.0, Apache-2.0) is declared in `package.json` but not imported by any source file.

Because the fonts load from `fonts.googleapis.com`, the Lite build reaches a third-party service on
startup, and the Standalone build falls back to system fonts when offline.

---

## Libraries with additional terms

These are npm packages, so the policy gate covers them too, but each one carries copyleft or
attribution terms worth naming explicitly.

### MarchingSquaresJS 1.3.3 — AGPL-3.0 with an additional permission

Reached indirectly: `@turf/turf` → `@turf/isobands` and `@turf/isolines` → `marchingsquares`. Cockpit does
not call the isoband or isoline functions, and the package is tree-shaken out of the renderer bundle, but
electron-builder copies every production dependency's files into the Standalone application, so the
package is distributed on disk.

Its license grants an additional permission under AGPL-3.0 section 7 covering exactly this use: third
parties, commercial ones included, may distribute, include or link against **unmodified** versions without
that alone bringing the third-party project under the AGPL. Modifications to MarchingSquaresJS itself must
be published. Cockpit uses it unmodified and does not modify it.

- Source: <https://github.com/RaumZeit/MarchingSquares.js>
- Notice:

```
MarchingSquaresJS
Copyright (c) 2015, 2015 Ronny Lorenz <ronny@tbi.univie.ac.at>

As additional permission under GNU Affero General Public License version 3
section 7, third-party projects (personal or commercial) may distribute,
include, or link against UNMODIFIED VERSIONS of MarchingSquaresJS without the
requirement that said third-party project for that reason alone becomes
subject to any requirement of the GNU Affero General Public License version 3.
Any modifications to MarchingSquaresJS, however, must be shared with the public
and made available.
```

### leaflet.offline 3.1.0 — LGPL-3.0

Used by `src/composables/map/useMapTileLayers.ts` and `src/composables/useOfflineTiles.ts` to cache map
tiles for offline use. It is bundled unmodified into both Standalone and Lite, statically linked into
Cockpit's JavaScript bundle, so each build is a Combined Work under LGPL-3.0 section 4.

- License: LGPL-3.0, as published in the package and declared by the upstream repository. The package's
  npm `license` field reads `ISC` and does not match its own license file; the license file governs.
- Source: <https://github.com/allartk/leaflet.offline>. The exact library used is the unmodified npm
  tarball for version 3.1.0, <https://registry.npmjs.org/leaflet.offline/-/leaflet.offline-3.1.0.tgz>,
  which carries the full LGPL-3.0 text in its `LICENSE` file.
- Section 4 notice: Cockpit uses leaflet.offline and it is covered by the GNU Lesser General Public
  License version 3. A recipient may replace it with a modified version by installing that version over
  `node_modules/leaflet.offline` in the Cockpit sources and rebuilding, which is the same mechanism
  Cockpit itself uses to link it. Cockpit's own sources are published at
  <https://github.com/bluerobotics/cockpit>, so the material needed to relink is available for every
  release regardless of which arm of Cockpit's license a recipient is using.

### GSAP 3.13.0 — GreenSock Standard "no charge" License

Used for widget animations in `Compass.vue`, `CompassHUD.vue`, `DepthHUD.vue`, `Attitude.vue` and
`VirtualHorizon.vue`. GSAP is **not** MIT.

- License: GreenSock Standard "no charge" License, <https://gsap.com/standard-license>, effective
  2025-04-30. This is a custom license, not an OSI-approved one, and the npm `license` field carries the
  URL rather than an SPDX identifier.
- Source: <https://github.com/greensock/GSAP>
- Notice: `Copyright (c) 2008-2025, GreenSock. All rights reserved.`
- Cockpit imports only the core `gsap` module. It uses none of the plugins that were formerly
  Club GreenSock-only, and the standard license covers the commercial use Cockpit makes of it. No
  attribution is required in the user interface.
- The license's one substantive restriction is on tools that let users build visual animations without
  code, which is Webflow's own market. Cockpit lets users arrange and configure telemetry widgets, not
  author animations, so it is not such a tool. GSAP here only interpolates numbers that canvas widgets
  then draw.
- Two properties of this license have no equivalent among the others listed in this file, and are the
  reason it is called out rather than left to the policy gate. Section IV keeps all rights with Webflow and
  grants only use, reproduction, display and implementation, so it conveys no right to modify or to
  redistribute under other terms. Section V allows Webflow to revoke the grant, and section VI.2 allows it
  to change these terms by editing that web page, with previously released versions staying under the
  terms in force when they were released.
- Because of that, GSAP is not conveyable under the AGPL arm the way the rest of Cockpit is. A recipient
  exercising AGPL rights over a Cockpit build receives GSAP under Webflow's terms above, directly from
  Webflow, and not under the AGPL.

### `jsts` 2.7.1 and `@turf/jsts` 2.7.2 — EDL-1.0 OR EPL-1.0

Reached through `@turf/turf`. The dual offer includes EDL-1.0, the Eclipse Distribution License, which is
a BSD-3-Clause-equivalent permissive license.

- Source: <https://github.com/bjornharrtell/jsts>

### `posthog-js` — Apache-2.0

The npm `license` field reads `SEE LICENSE IN LICENSE`; the package's `LICENSE` file is the Apache
License 2.0.

- Notice: `Copyright 2020 Posthog / Hiberly, Inc.` and `Copyright 2015 Mixpanel, Inc.`
- Source: <https://github.com/PostHog/posthog-js>

### `splaytree-ts` 1.0.2 — BSD-3-Clause

The npm `license` field reads `BDS-3-Clause`, which is not a valid SPDX identifier. The package's
`LICENSE` file is the BSD 3-Clause License, `Copyright (c) 2022, Luiz Felipe Machado Barboza`.

---

## Permissive npm libraries

The remaining bundled npm packages are under MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0,
CC0-1.0, Unlicense or BlueOak-1.0.0. Their notices are the license files inside each package: Standalone
carries them, since electron-builder copies every production dependency's files into the application,
while Lite serves a compiled bundle and carries only the notices reproduced in this file. The larger ones
worth naming:

| Component | Version | License | Notice |
| --- | --- | --- | --- |
| Vue | 3.x | MIT | Copyright (c) 2018-present, Yuxi (Evan) You |
| Vuetify | 3.7.0 | MIT | Copyright (c) 2016-present Vuetify LLC |
| Leaflet | 1.9.3 | BSD-2-Clause | Copyright (c) 2010-2022, Vladimir Agafonkin; Copyright (c) 2010-2011, CloudMade |
| leaflet-edgebuffer | 1.0.7 | MIT | Copyright (c) 2015-2017, 2025 Alex Paterson |
| Monaco Editor | 0.52.2 | MIT | Copyright (c) 2016 - present Microsoft Corporation |
| Turf.js | 7.2.0 | MIT | Copyright (c) TurfJS |
| Pinia | 2.x | MIT | Copyright (c) 2019-present Eduardo San Martin Morote |
| math.js | 13.x | Apache-2.0 | Copyright (C) 2013-2024 Jos de Jong |
| Sentry SDK (`@sentry/vue`) | 8.x | MIT | Copyright (c) 2019 Sentry |
| Workbox (service worker generated by `vite-plugin-pwa`) | 7.3.0 | MIT | Copyright 2018 Google LLC |

---

## Map tile services

Cockpit fetches map tiles from third-party services at runtime and does not redistribute any imagery. Tile
URLs and attributions are defined in `src/composables/map/useMapTileLayers.ts`.

| Service | Attribution shown on the map | Terms |
| --- | --- | --- |
| OpenStreetMap | © OpenStreetMap | Map data under ODbL; tile usage under the [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) |
| Esri World Imagery | © Esri World Imagery | Esri's terms of use for ArcGIS Online basemaps |
| OpenSeaMap seamarks | © OpenSeaMap contributors | ODbL |
| GEBCO, via the OpenSeaMap GeoServer | © GEBCO, OpenSeaMap | GEBCO's terms for its bathymetric grid |

---

## The rest of the npm tree

The tables above name the components whose terms go beyond a permissive notice. The rest of the resolved
dependency tree is machine-checked rather than maintained by hand:

```bash
yarn licenses:check    # policy gate, also run in CI
```

It compares the tree yarn resolves from `yarn.lock` against the policy in `scripts/license-policy.json`
and flags every package whose license is neither on the allowlist nor already recorded. A flagged package
that reaches a user fails the check — the production tree, plus whatever a build plugin compiles into what
ships — so adding a dependency under a copyleft, custom or unrecognized license fails CI until the
decision is recorded. A flagged package that only runs on a developer machine warns instead, and CI
passes. Where a recorded decision rests on the package's own license file — correcting the npm metadata,
or relying on a permission written into the license text — it is pinned to the version that file was read
at, so upgrading the package re-asks the question. See
[`scripts/license-policy.json`](scripts/license-policy.json) for the current policy.
