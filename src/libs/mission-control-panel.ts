import { widgetProfiles } from '@/assets/defaults'
import { type InternalWidgetSetupInfo, WidgetType } from '@/types/widgets'

/**
 * Derives the setup info for a mission control panel from the default profiles, so every producer
 * places it where the stock map view keeps it. No size is returned, as the widget assigns its own
 * on mount.
 * @returns {InternalWidgetSetupInfo | undefined} The setup info, or undefined when no default profile carries the panel
 */
export const missionControlPanelSetupInfo = (): InternalWidgetSetupInfo | undefined => {
  const template = widgetProfiles
    .flatMap((profile) => profile.views)
    .flatMap((view) => view.widgets)
    .find((widget) => widget.component === WidgetType.MissionControlPanel)

  if (!template) return undefined

  return {
    component: template.component,
    name: template.name,
    options: template.options,
    icon: '',
    defaultPosition: template.position,
  }
}
