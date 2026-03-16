import { useStorage } from '@vueuse/core'
import { watch } from 'vue'

import { widgetProfiles } from '@/assets/defaults'
import { setupPostPiniaConnection } from '@/libs/post-pinia-connections'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { WidgetType } from '@/types/widgets'

const usersMigratedMissionControlPanel = useStorage<string[]>('cockpit-users-migrated-mission-control-panel', [])

/**
 * Adds a MissionControlPanel widget to every view that has a Map widget but no MissionControlPanel yet.
 * Tracks which users have already been migrated to avoid duplicate additions.
 * @param {string} username - The current user's name
 */
const performMapMissionControlPanelMigration = (username: string): void => {
  if (!username || usersMigratedMissionControlPanel.value.includes(username)) {
    return
  }

  const widgetStore = useWidgetManagerStore()

  const missionControlPanelTemplate = widgetProfiles
    .flatMap((profile) => profile.views)
    .flatMap((view) => view.widgets)
    .find((widget) => widget.component === WidgetType.MissionControlPanel)

  if (!missionControlPanelTemplate) return

  let hasChanges = false
  const profile = widgetStore.currentProfile
  profile.views.forEach((view) => {
    const hasMap = view.widgets.some((w) => w.component === WidgetType.Map)
    const hasMissionCP = view.widgets.some((w) => w.component === WidgetType.MissionControlPanel)

    if (hasMap && !hasMissionCP) {
      widgetStore.addWidget(
        {
          component: missionControlPanelTemplate.component,
          name: missionControlPanelTemplate.name,
          options: missionControlPanelTemplate.options,
          icon: '',
        },
        view
      )
      const addedWidget = view.widgets[0]
      if (addedWidget?.component === WidgetType.MissionControlPanel) {
        addedWidget.position = missionControlPanelTemplate.position
        addedWidget.size = missionControlPanelTemplate.size
      }
      hasChanges = true
    }
  })

  if (hasChanges) {
    usersMigratedMissionControlPanel.value.push(username)
  }
}

/**
 * Runs all widget migration routines for the given user.
 * Each migration is responsible for checking whether it has already been applied.
 * @param {string} username - The current user's name
 */
const performWidgetsMigrations = (username: string): void => {
  performMapMissionControlPanelMigration(username)
}

setupPostPiniaConnection(() => {
  const missionStore = useMissionStore()

  if (missionStore.username) performWidgetsMigrations(missionStore.username)

  watch(
    () => missionStore.username,
    (username) => {
      console.log(':smile: username changed', username)
      if (username) performWidgetsMigrations(username)
    }
  )
})
