import { expect, test } from 'vitest'

import { parseMavlinkDump } from '@/libs/mavlink-dump-parser'

const line = (msg: unknown, dir = 'in'): string => JSON.stringify({ ts: 1_700_000_000_000, dir, msg })
const heartbeat = { header: { system_id: 1, component_id: 1 }, message: { type: 'HEARTBEAT', custom_mode: 4 } }

test("mavlink2rest's replies to sent messages are neither messages nor invalid lines", () => {
  const result = parseMavlinkDump([line(heartbeat), line('Ok(21)'), line('Ok(28)')].join('\n'))
  expect(result.messageCount).toBe(1)
  expect(result.invalidLineCount).toBe(0)
})

test('lines that are really broken are still counted', () => {
  const result = parseMavlinkDump([line(heartbeat), '{not json', line('garbage')].join('\n'))
  expect(result.messageCount).toBe(1)
  expect(result.invalidLineCount).toBe(2)
})
