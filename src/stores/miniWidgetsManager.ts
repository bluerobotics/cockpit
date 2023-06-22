/* eslint-disable jsdoc/require-jsdoc */
import '@/libs/cosmos'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

import { miniWidgetsProfile } from '@/assets/defaults'
import { type MiniWidget, type MiniWidgetContainer, MiniWidgetType } from '@/types/miniWidgets'

export const useMiniWidgetsManagerStore = defineStore('mini-widgets-manager', () => {
  const currentMiniWidgetsProfile = useStorage('cockpit-mini-widgets-profile', miniWidgetsProfile)

  function addWidgetToContainer(widgetType: MiniWidgetType, container: MiniWidgetContainer): void {
    container.widgets.unshift({
      component: widgetType,
      options: {},
    })
  }

  function removeWidgetFromContainer(widget: MiniWidget, container: MiniWidgetContainer): void {
    const index = container.widgets.indexOf(widget)
    container.widgets.splice(index, 1)
  }

  return {
    currentMiniWidgetsProfile,
    addWidgetToContainer,
    removeWidgetFromContainer,
  }
})
