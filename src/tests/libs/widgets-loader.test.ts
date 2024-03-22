import { expect, test } from 'vitest'

import { WidgetType } from '@/types/widgets'

test('Test widgets exist', async () => {
  const loader = await Promise.allSettled(
    Object.values(WidgetType).map((name) => import(`@/components/widgets/${name}.vue`))
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
})
