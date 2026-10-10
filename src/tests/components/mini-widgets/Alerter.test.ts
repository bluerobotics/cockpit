import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import Alerter from '@/components/mini-widgets/Alerter.vue'
import { MiniWidget, MiniWidgetType } from '@/types/widgets'

vi.mock('@/stores/alert', () => {
  const alerts = [{ level: 'info', message: 'Test alert', time_created: new Date() }]
  return { useAlertStore: () => ({ alerts, sortedAlerts: alerts }) }
})
vi.mock('@/stores/vehicleAlerter', () => ({ useVehicleAlerterStore: () => undefined }))
vi.mock('@/stores/widgetManager', () => ({
  useWidgetManagerStore: () => ({ editingMode: false, miniWidgetManagerVars: () => ({ configMenuOpen: false }) }),
}))
vi.mock('@/components/InteractionDialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('vuetify/components/VIcon', () => ({ VIcon: { template: '<i />' } }))
vi.mock('vuetify/components/VSwitch', () => ({ VSwitch: { template: '<div />' } }))
vi.mock('vuetify/components/VSlider', () => ({ VSlider: { template: '<div />' } }))
vi.mock('vuetify/components/VBtn', () => ({ VBtn: { template: '<button />' } }))

const originalLogUserAction = globalThis.logUserAction
afterEach(() => vi.stubGlobal('logUserAction', originalLogUserAction))

test('unlocking closes hovered alerts immediately and lets a later hover reopen them', async () => {
  vi.stubGlobal('logUserAction', vi.fn())
  const miniWidget = reactive<MiniWidget>({
    hash: 'alerter-test',
    name: 'Alerter',
    component: MiniWidgetType.Alerter,
    options: {},
  })
  const wrapper = mount(Alerter, { props: { miniWidget } })

  try {
    await nextTick()
    const currentAlertBar = new DOMWrapper(wrapper.vm.$refs.currentAlertBar as HTMLElement)
    const expandedAlerts = wrapper.get('.expanded-alerts-bar')
    const lock = expandedAlerts.get('.lock-icon')
    expect(expandedAlerts.classes()).toContain('invisible')

    await currentAlertBar.trigger('mouseenter')
    await expandedAlerts.trigger('mouseenter')
    expect(expandedAlerts.classes()).not.toContain('invisible')

    await lock.trigger('click')
    expect(miniWidget.options.lockExpansion).toBe(true)
    await currentAlertBar.trigger('mouseleave')
    await expandedAlerts.trigger('mouseleave')
    expect(expandedAlerts.classes()).not.toContain('invisible')

    await currentAlertBar.trigger('mouseenter')
    await expandedAlerts.trigger('mouseenter')
    await lock.trigger('click')
    expect(miniWidget.options.lockExpansion).toBe(false)
    expect(expandedAlerts.classes()).toContain('invisible')

    await expandedAlerts.trigger('mouseleave')
    await currentAlertBar.trigger('mouseleave')
    expect(expandedAlerts.classes()).toContain('invisible')
    await currentAlertBar.trigger('mouseenter')
    expect(expandedAlerts.classes()).not.toContain('invisible')
  } finally {
    wrapper.unmount()
  }
})
