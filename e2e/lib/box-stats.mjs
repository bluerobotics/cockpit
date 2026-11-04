// CPU and memory on the measured machine while a case runs (remote/box-stats.ps1, Windows' typeperf once a second),
// summed up per measured window: how busy the machine was, how much of it was Cockpit and which of its processes,
// and which other processes were busy at the same time.

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const ps = (remote, action) =>
  spawnSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      remote,
      `powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\\e2e\\box-stats.ps1" ${action}`,
    ],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024 }
  )

/**
 * Start sampling. Call it once the app is up: processes started later are not seen.
 * @param {string} remote - ssh host of the measured machine
 * @returns {string|null} Why sampling did not start, or null
 */
export function startBoxStats(remote) {
  const r = ps(remote, 'start')
  return r.status === 0 ? null : r.stderr.trim().split('\n').slice(-2).join(' ') || `exit ${r.status}`
}

/**
 * Stop sampling and fetch what was sampled.
 * @param {string} remote - ssh host of the measured machine
 * @returns {{cores: number, utcOffsetMinutes: number, roles: {pid: number, role: string}[], csv: string}|null} The
 *   samples, or null when nothing came back
 */
export function stopBoxStats(remote) {
  const r = ps(remote, 'stop')
  if (r.status !== 0) return null
  try {
    return JSON.parse(r.stdout)
  } catch {
    return null
  }
}

const cells = (line) => line.replace(/^"|"$/g, '').split('","')

/**
 * The samples as a time series on the epoch clock, per process name (Cockpit's processes by role).
 * @param {object} stats - What `stopBoxStats` returned
 * @param {number} stats.cores - Logical CPUs, which per-process CPU is divided by
 * @param {number} stats.utcOffsetMinutes - The machine's offset from UTC, for its local sample times
 * @param {{pid: number, role: string}[]} stats.roles - Cockpit's processes and what each one is
 * @param {string} stats.csv - What typeperf wrote
 * @returns {{at: number, cpu: number, queue: number, freeMB: number, procs: Record<string, {cpu: number, mb: number}>}[]}
 *   One entry per second; CPU as a share of the whole machine (0–100)
 */
export function boxSeries({ cores, utcOffsetMinutes, roles, csv }) {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const head = cells(lines[0])
  const role = new Map((roles ?? []).map((r) => [r.pid, r.role]))
  const column = (re) => head.findIndex((h) => re.test(h))
  const total = column(/Processor\(_Total\)\\% Processor Time$/)
  const queue = column(/Processor Queue Length$/)
  const free = column(/Available MBytes$/)
  // One entry per process instance, with the columns of its three counters.
  const instances = new Map()
  head.forEach((h, i) => {
    const m = h.match(/\\Process\(([^)]+)\)\\(% Processor Time|Working Set - Private|ID Process)$/)
    if (!m || m[1] === '_Total' || m[1] === 'Idle') return
    const entry = instances.get(m[1]) ?? {}
    entry[m[2]] = i
    instances.set(m[1], entry)
  })
  return lines.slice(1).map((line) => {
    const v = cells(line)
    const [date, time] = v[0].split(' ')
    const [mo, d, y] = date.split('/').map(Number)
    const [h, mi, s] = time.split(':')
    const at = Date.UTC(y, mo - 1, d, Number(h), Number(mi), 0) + Number(s) * 1000 - utcOffsetMinutes * 60000
    const procs = {}
    for (const [instance, c] of instances) {
      const cpu = Number(v[c['% Processor Time']]) / cores
      const mb = Number(v[c['Working Set - Private']]) / 1048576
      if (!Number.isFinite(cpu) && !Number.isFinite(mb)) continue
      const base = instance.replace(/#\d+$/, '')
      const pid = Number(v[c['ID Process']])
      const name = /^(Cockpit|electron)$/i.test(base) ? `Cockpit ${role.get(pid) ?? 'other'}` : base
      const sum = (procs[name] ??= { cpu: 0, mb: 0 })
      sum.cpu += Number.isFinite(cpu) ? cpu : 0
      sum.mb += Number.isFinite(mb) ? mb : 0
    }
    return { at, cpu: Number(v[total]), queue: Number(v[queue]), freeMB: Number(v[free]), procs }
  })
}

const round = (n) => Math.round(n * 10) / 10
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN)

/**
 * How busy the machine was over one stretch of time.
 * @param {object[]} series - What `boxSeries` returned
 * @param {number} from - Epoch ms
 * @param {number} to - Epoch ms
 * @returns {object|null} CPU (whole machine, Cockpit and per Cockpit role), the busiest other processes, Cockpit's
 *   memory and the free memory; null without samples in the stretch
 */
export function boxWindow(series, from, to) {
  const samples = series.filter((s) => s.at >= from && s.at <= to)
  if (!samples.length) return null
  const names = [...new Set(samples.flatMap((s) => Object.keys(s.procs)))]
  const avg = (name) => mean(samples.map((s) => s.procs[name]?.cpu ?? 0))
  const cockpit = names.filter((n) => n.startsWith('Cockpit '))
  const others = names
    .filter((n) => !n.startsWith('Cockpit '))
    .map((n) => ({ name: n, cpu: round(avg(n)) }))
    .sort((a, b) => b.cpu - a.cpu)
  const last = samples.at(-1)
  return {
    samples: samples.length,
    cpu: { mean: round(mean(samples.map((s) => s.cpu))), max: round(Math.max(...samples.map((s) => s.cpu))) },
    queue: { mean: round(mean(samples.map((s) => s.queue))), max: Math.max(...samples.map((s) => s.queue)) },
    cockpitCpu: round(cockpit.reduce((sum, n) => sum + avg(n), 0)),
    cockpitRoles: Object.fromEntries(cockpit.map((n) => [n.slice(8), round(avg(n))])),
    cockpitMB: Math.round(cockpit.reduce((sum, n) => sum + (last.procs[n]?.mb ?? 0), 0)),
    freeMB: Math.min(...samples.map((s) => s.freeMB)),
    top: others.slice(0, 5),
  }
}

/**
 * Add the machine's load to a case's performance results: a `box` summary on every measured window, the series on
 * `perf.box`, and the raw typeperf CSV next to the other files.
 * @param {object} perf - What `finishSampling` returned
 * @param {object|null} stats - What `stopBoxStats` returned
 * @param {string} csvFile - Where to keep the raw CSV
 * @returns {string|null} Why nothing was added, or null
 */
export function attachBoxStats(perf, stats, csvFile) {
  if (!stats?.csv) return 'no samples came back'
  writeFileSync(csvFile, stats.csv)
  const series = boxSeries(stats)
  const at = (prefix, label) => perf.raw.marks.find(([, l]) => l === `${prefix}:${label}`)?.[0]
  for (const w of perf.windows) {
    const begin = at('begin', w.label)
    const end = at('end', w.label)
    w.box =
      begin === undefined || end === undefined
        ? null
        : boxWindow(series, perf.raw.origin + begin, perf.raw.origin + end)
  }
  perf.box = { cores: stats.cores, roles: stats.roles, series }
  return null
}
