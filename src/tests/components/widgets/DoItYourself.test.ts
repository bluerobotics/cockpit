import { flushPromises, shallowMount } from '@vue/test-utils'
import { expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'

import DoItYourself from '@/components/widgets/DoItYourself.vue'
import { openActionErrorSnackbar } from '@/composables/snackbar'
import { Widget, WidgetType } from '@/types/widgets'

vi.mock('@/composables/snackbar', () => ({
  openActionErrorSnackbar: vi.fn(),
  useSnackbar: () => ({ openSnackbar: vi.fn() }),
}))
vi.mock('@/composables/interactionDialog', () => ({
  useInteractionDialog: () => ({ showDialog: vi.fn(), closeDialog: vi.fn() }),
}))
vi.mock('@/composables/settingsSyncer', () => ({ useBlueOsStorage: (_key: string, value: unknown) => ref(value) }))
vi.mock('@/libs/diy-widget-library', () => ({ getAllDiyWidgetTemplates: vi.fn(), saveDiyWidgetTemplate: vi.fn() }))
vi.mock('@/libs/monaco-manager', () => ({ createMonacoEditor: vi.fn(), monaco: {} }))
vi.mock('@/stores/appInterface', () => ({
  useAppInterfaceStore: () => ({ globalGlassMenuStyles: {}, isOnSmallScreen: false }),
}))
vi.mock('@/stores/widgetManager', () => ({
  useWidgetManagerStore: () => ({ widgetManagerVars: () => ({ configMenuOpen: false }) }),
}))

vi.mock('@/libs/settings-management', () => ({ settingsManager: { getKeyValue: vi.fn(), setKeyValue: vi.fn() } }))
vi.mock('vuetify/components/VBtn', () => ({ VBtn: { template: '<button />' } }))
vi.mock('vuetify/components/VCard', () => ({ VCard: {}, VCardActions: {}, VCardText: {}, VCardTitle: {} }))
vi.mock('vuetify/components/VCheckbox', () => ({ VCheckbox: {} }))
vi.mock('vuetify/components/VDialog', () => ({ VDialog: {} }))
vi.mock('vuetify/components/VExpansionPanel', () => ({
  VExpansionPanel: {},
  VExpansionPanels: {},
  VExpansionPanelText: {},
  VExpansionPanelTitle: {},
}))
vi.mock('vuetify/components/VIcon', () => ({ VIcon: {} }))
vi.mock('vuetify/components/transitions', () => ({ VExpandTransition: {} }))

test('names the widget when its scoped script throws on load', async () => {
  const widget = reactive<Widget>({
    hash: 'diy-test',
    name: 'Depth gauge',
    component: WidgetType.DoItYourself,
    position: { x: 0, y: 0 },
    size: { width: 0.2, height: 0.2 },
    options: { html: '<div></div>', css: '', js: "throw new Error('boom')", scopedScript: true },
  })
  const wrapper = shallowMount(DoItYourself, {
    props: { widget },
    global: { stubs: { 'vue-draggable-resizable': true } },
  })

  try {
    await flushPromises()
    expect(openActionErrorSnackbar).toHaveBeenCalledWith(
      new Error('Error running the DIY widget "Depth gauge" script: Error: boom')
    )
  } finally {
    wrapper.unmount()
  }
})
