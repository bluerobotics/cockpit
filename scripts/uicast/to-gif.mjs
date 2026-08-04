#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */
// Convert a recording to an animated GIF small enough to render inline in a GitHub comment.
//
//   node scripts/uicast/to-gif.mjs <in.mp4> <out.gif> [--max-mb N]
//
// GitHub proxies images through camo, which refuses to serve anything oversized — a GIF over the
// cap silently shows as a broken image. So quality is stepped down until the file fits.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FFMPEG = process.env.FFMPEG_BIN ?? 'ffmpeg'

const [input, out, ...rest] = process.argv.slice(2)
if (!input || !out) {
  console.error('usage: to-gif.mjs <in.mp4> <out.gif> [--max-mb N]')
  process.exit(1)
}

const maxMbIndex = rest.indexOf('--max-mb')
const maxBytes = Number(maxMbIndex === -1 ? 5 : rest[maxMbIndex + 1]) * 1024 * 1024

// Widest and smoothest first; each rung roughly halves the file.
const LADDER = [
  { width: 800, fps: 10 },
  { width: 640, fps: 10 },
  { width: 640, fps: 8 },
  { width: 520, fps: 8 },
  { width: 440, fps: 6 },
]

const dir = mkdtempSync(join(tmpdir(), 'uicast-gif-'))
const palette = join(dir, 'palette.png')

const run = (args) => {
  const result = spawnSync(FFMPEG, ['-y', ...args], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr?.slice(-2000) ?? 'ffmpeg failed')
}

let written = null
for (const { width, fps } of LADDER) {
  const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`
  // A palette generated from the whole clip beats the default 256-colour quantisation, which
  // turns Cockpit's dark UI and satellite tiles into banded mud.
  run(['-i', input, '-vf', `${filters},palettegen=stats_mode=diff`, palette])
  run(['-i', input, '-i', palette, '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`, out])

  const bytes = statSync(out).size
  written = { width, fps, bytes }
  console.log(`${width}px @ ${fps}fps → ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  if (bytes <= maxBytes) break
}

rmSync(dir, { recursive: true, force: true })

if (written.bytes > maxBytes) {
  console.warn(
    `warning: ${out} is still over the ${(maxBytes / 1024 / 1024).toFixed(1)} MB cap; it may not render inline`
  )
}
console.log(`wrote ${out} — ${written.width}px, ${written.fps}fps, ${(written.bytes / 1024 / 1024).toFixed(2)} MB`)
