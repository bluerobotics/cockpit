import { expect, test } from 'vitest'

import { MiniWidgetType } from '@/types/miniWidgets'
import { WidgetType } from '@/types/widgets'

test('Test widgets exist', async () => {
  await enum_to_files_checker(WidgetType, '@/components/widgets/${name}.vue')
})

test('Test mini-widgets exist', async () => {
  await enum_to_files_checker(MiniWidgetType, '@/components/mini-widgets/${name}.vue')
})

/**
 * Test helper to verify if all enums names matches with a file list in a path
 * @param {T} enum_type Enum type with values as filenames
 * @param {string} path_template Path template as string, where name should be used as filename
 */
async function enum_to_files_checker<T>(enum_type: T, path_template: string): Promise<void> {
  const loader = await Promise.allSettled(
    /* eslint-disable @typescript-eslint/no-unused-vars */
    Object.values(enum_type).map((name) => import(eval('`' + path_template + '`'))) // Please, have marcy of my soul
  )
  const found_all_files = loader.every((file) => {
    if (file.status == 'fulfilled') {
      return true
    }
    const failed_to_find = file.reason.message.includes('Failed to load')
    if (failed_to_find) {
      console.error(`Failed to find: ${file.reason}`)
    }
    return !failed_to_find
  })
  expect(found_all_files).toBe(true)
}
