import { miniWidgetsProfiles, widgetProfiles } from '@/assets/defaults'
import { type MiniWidget, MiniWidgetType } from '@/types/widgets'

// The display name, the icon and the width say nothing about what the number means, so changing
// them does not make the indicator the user's own.
const optionsDefiningTheValue = ['variableName', 'variableUnit', 'variableMultiplier'] as const

const shippedIndicatorKey = (options: MiniWidget['options']): string =>
  optionsDefiningTheValue.map((option) => String(options[option])).join('|')

const shippedIndicators = new Set(
  [
    ...widgetProfiles.flatMap((profile) => profile.views.flatMap((view) => view.miniWidgetContainers)),
    ...miniWidgetsProfiles.flatMap((profile) => profile.containers),
  ]
    .flatMap((container) => container.widgets)
    .filter(
      (widget) => widget.component === MiniWidgetType.VeryGenericIndicator && widget.options.useVariableUnit === true
    )
    .map((widget) => shippedIndicatorKey(widget.options))
)

/**
 * Whether an indicator is still one of Cockpit's own unit-following readouts, reading the variable,
 * unit and multiplier it was shipped with.
 * @param {MiniWidget} miniWidget The indicator to check
 * @returns {boolean} True when the indicator still reads a quantity Cockpit ships with the variable's unit
 */
export const isIndicatorAsShipped = (miniWidget: MiniWidget): boolean =>
  shippedIndicators.has(shippedIndicatorKey(miniWidget.options))
