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
vi.mock('@/libs/actions/data-lake', () => ({
  dataLakeVariableData: {},
  getAllDataLakeVariablesInfo: () => ({}),
}))
vi.mock('@/libs/joystick/protocols/cockpit-actions', () => ({ availableCockpitActions: {} }))
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

test('names the widget once when its sandboxed script throws', async () => {
  const widget = reactive<Widget>({
    hash: 'diy-test',
    name: 'Depth gauge',
    component: WidgetType.DoItYourself,
    position: { x: 0, y: 0 },
    size: { width: 0.2, height: 0.2 },
    options: { html: '<div></div>', css: '', js: "throw new Error('boom')" },
  })
  const wrapper = shallowMount(DoItYourself, {
    props: { widget },
    attachTo: document.body,
    global: { stubs: { 'vue-draggable-resizable': true } },
  })

  try {
    await flushPromises()
    const frame = wrapper.find('iframe').element as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
    const frameId = frame.getAttribute('srcdoc')?.match(/const frameId = "([^"]+)"/)?.[1]
    const reportError = (): void => {
      const data = { channel: 'cockpit-diy-widget', frameId, type: 'error', message: 'Error: boom' }
      window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow }))
    }
    reportError()
    reportError()
    expect(openActionErrorSnackbar).toHaveBeenCalledOnce()
    expect(openActionErrorSnackbar).toHaveBeenCalledWith(
      new Error('Error running the DIY widget "Depth gauge" script: Error: boom')
    )
  } finally {
    wrapper.unmount()
  }
})
