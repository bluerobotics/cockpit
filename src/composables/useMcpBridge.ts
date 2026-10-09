import { v4 as uuid4 } from 'uuid'
import { onBeforeUnmount } from 'vue'
import { z } from 'zod'

import { type McpTool, defineMcpTool, libMcpTools, mcpToolDefinition } from '@/libs/mcp/tools'
import { externalPoiIdSchema, externalPoiSchema, externalPoiUpdateSchema } from '@/libs/poi/external-api'
import { isElectron } from '@/libs/utils'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { McpToolCall } from '@/types/mcp'
import {
  type MiniWidget,
  type MiniWidgetContainer,
  type View,
  type Widget,
  MiniWidgetType,
  widgetDefaultSizes,
  WidgetType,
} from '@/types/widgets'

import { openSnackbar } from './snackbar'
import { usePointsOfInterest } from './usePointsOfInterest'

const errorMessage = (error: unknown): string => {
  if (error instanceof z.ZodError) return z.prettifyError(error)
  return error instanceof Error ? error.message : String(error)
}

const fraction = z.number().min(0).max(1)
const positionInput = z.object({ x: fraction, y: fraction })
const sizeInput = z.object({ width: fraction, height: fraction })
// Their options hold agent-authored code or pages, or the operator's own mini-widgets, so agents cannot set them.
const widgetsWithProtectedOptions = [
  WidgetType.DoItYourself,
  WidgetType.IFrame,
  WidgetType.CollapsibleContainer,
  WidgetType.MiniWidgetsBar,
]
const viewHashInput = z.string().min(1).optional().describe('View to act on. Defaults to the current one')
const scriptDescription =
  "Runs when the widget mounts, in its own scope, with two arguments. root is this widget's element: find " +
  'the markup with root.querySelector, never document.getElementById, since the widget may be copied. ' +
  'cockpit is the data-lake API: register with cockpit.listenDataLakeVariable(id, callback), ' +
  'cockpit.setInterval and cockpit.setTimeout so they are undone with the widget, and pass any other ' +
  'teardown to cockpit.onCleanup(fn). Top-level functions are not global, so attach event listeners from ' +
  'the script rather than with inline onclick attributes.'

const diyCode = z.object({
  name: z.string().min(1).default('Do it yourself'),
  html: z.string(),
  css: z.string().default(''),
  js: z.string().default('').describe(scriptDescription),
})

const widgetTools = (): McpTool[] => {
  const widgetStore = useWidgetManagerStore()

  const widgetOrThrow = (hash: string): Widget => {
    const widget = widgetStore.currentProfile.views.flatMap((view) => view.widgets).find((w) => w.hash === hash)
    if (widget === undefined) throw new Error(`No widget with hash '${hash}'.`)
    return widget
  }

  const diyWidgetOrThrow = (hash: string): Widget => {
    const widget = widgetOrThrow(hash)
    if (widget.component !== WidgetType.DoItYourself) throw new Error(`Widget '${hash}' is not a DIY widget.`)
    return widget
  }

  const viewOrThrow = (hash: string | undefined): View => {
    const view = widgetStore.currentProfile.views.find((v) => v.hash === (hash ?? widgetStore.currentView.hash))
    if (view === undefined) throw new Error(`No view with hash '${hash}'.`)
    return view
  }

  // The top bar is shared by every view, while bottom and floating bars belong to one view.
  const miniWidgetContainersOf = (view: View): MiniWidgetContainer[] => [
    ...widgetStore.currentMiniWidgetsProfile.containers,
    ...view.miniWidgetContainers,
    ...view.widgets
      .filter((w) => w.component === WidgetType.MiniWidgetsBar && w.options.miniWidgetsContainer)
      .map((w) => w.options.miniWidgetsContainer as MiniWidgetContainer),
  ]

  const miniWidgetContainerOrThrow = (view: View, name: string): MiniWidgetContainer => {
    const container = miniWidgetContainersOf(view).find((c) => c.name === name)
    if (container === undefined) throw new Error(`No mini-widget container named '${name}' on view '${view.hash}'.`)
    return container
  }

  const addDiyWidget = (
    viewHash: string | undefined,
    code: z.output<typeof diyCode>,
    geometry: Pick<Widget, 'position' | 'size'>
  ): Widget => {
    const view = viewOrThrow(viewHash)
    const { name, ...options } = code
    const setup = {
      component: WidgetType.DoItYourself,
      name,
      icon: '',
      options: { ...options, inheritCockpitStyles: true, scopedScript: true },
    }
    return widgetStore.addWidget({ ...setup, defaultPosition: geometry.position, defaultSize: geometry.size }, view)
  }

  return [
    defineMcpTool({
      name: 'list_views',
      title: 'List views',
      description:
        'List the views of the current profile and the widgets on each one. Positions and sizes are fractions of the view.',
      readOnly: true,
      runsCode: false,
      input: z.object({}),
      run: () => {
        return widgetStore.currentProfile.views.map((view) => ({
          hash: view.hash,
          name: view.name,
          current: view.hash === widgetStore.currentView.hash,
          widgets: view.widgets.map(({ hash, component, name, position, size }) => ({
            hash,
            component,
            name,
            position,
            size,
          })),
        }))
      },
    }),
    defineMcpTool({
      name: 'get_widget',
      title: 'Get widget',
      description: 'Get a widget with its options, which for a DIY widget hold its HTML, CSS and JavaScript.',
      readOnly: true,
      runsCode: false,
      input: z.object({ hash: z.string().min(1) }),
      run: ({ hash }) => widgetOrThrow(hash),
    }),
    defineMcpTool({
      name: 'add_diy_widget',
      title: 'Add DIY widget',
      description: 'Add a do-it-yourself widget built from HTML, CSS and JavaScript to a view.',
      readOnly: false,
      runsCode: true,
      input: z.object({
        viewHash: viewHashInput,
        ...diyCode.shape,
        position: positionInput.default({ x: 0.4, y: 0.32 }),
        size: sizeInput.default({ width: 0.2, height: 0.36 }),
      }),
      run: ({ viewHash, position, size, ...code }) => {
        return { hash: addDiyWidget(viewHash, code, { position, size }).hash }
      },
    }),
    defineMcpTool({
      name: 'update_diy_widget',
      title: 'Update DIY widget',
      description:
        'Change the code or name of a DIY widget, keeping its place, style and script mode. Fields left out ' +
        'stay as they are. The widget remounts so its script runs again, which gives it a new hash. Check ' +
        'options.scopedScript with get_widget first: a widget the operator made may run its script globally, ' +
        'where root and the tracked cockpit helpers do not exist.',
      readOnly: false,
      runsCode: true,
      input: z.object({
        hash: z.string().min(1),
        name: z.string().min(1).optional(),
        html: z.string().optional(),
        css: z.string().optional(),
        js: z.string().optional().describe(scriptDescription),
      }),
      run: ({ hash, name, ...code }) => {
        const widget = diyWidgetOrThrow(hash)
        Object.assign(widget.options, Object.fromEntries(Object.entries(code).filter(([, v]) => v !== undefined)))
        if (name !== undefined) widget.name = name
        // Widgets are keyed by hash, so a new one remounts this widget where it is, running its script again.
        const newHash = uuid4()
        Object.assign(widgetStore.widgetManagerVars(newHash), widgetStore.widgetManagerVars(hash))
        widget.hash = newHash
        return { hash: newHash }
      },
    }),
    defineMcpTool({
      name: 'delete_diy_widget',
      title: 'Delete DIY widget',
      description: 'Delete a DIY widget from its view. Other widgets belong to the operator and cannot be deleted.',
      readOnly: false,
      runsCode: false,
      input: z.object({ hash: z.string().min(1) }),
      run: ({ hash }) => {
        widgetStore.deleteWidget(diyWidgetOrThrow(hash))
        return { deleted: hash }
      },
    }),
    defineMcpTool({
      name: 'add_widget',
      title: 'Add widget',
      description:
        'Add a built-in widget to a view. Options left out take the widget defaults, so read them back with ' +
        'get_widget before changing them. DIY widgets are made with add_diy_widget instead. Iframes, collapsible ' +
        'containers and mini-widget bars take no options here.',
      readOnly: false,
      runsCode: false,
      input: z.object({
        viewHash: viewHashInput,
        component: z.enum(WidgetType).exclude([WidgetType.DoItYourself, WidgetType.IFrame]),
        name: z.string().min(1).optional(),
        options: z.record(z.string(), z.unknown()).default({}),
        position: positionInput.default({ x: 0.4, y: 0.32 }),
        size: sizeInput.optional().describe('Defaults to the size the edit menu gives this widget type'),
      }),
      run: ({ viewHash, component, name, options, position, size }) => {
        if (Object.keys(options).length > 0 && widgetsWithProtectedOptions.includes(component)) {
          throw new Error(`${component} widgets cannot be given options by an agent.`)
        }
        const view = viewOrThrow(viewHash)
        const setup = { component, name: widgetStore.uniqueWidgetName(name ?? component, view), icon: '', options }
        const defaultSize = size ?? widgetDefaultSizes[component]
        const widget = widgetStore.addWidget({ ...setup, defaultPosition: position, defaultSize }, view)
        return { hash: widget.hash }
      },
    }),
    defineMcpTool({
      name: 'update_widget',
      title: 'Update widget',
      description:
        'Rename, move, resize or change the options of a widget. Fields left out stay as they are, and options ' +
        'are merged into the current ones. The options of DIY widgets, iframes, collapsible containers and ' +
        "mini-widget bars cannot be changed; a DIY widget's code is changed with update_diy_widget.",
      readOnly: false,
      runsCode: false,
      input: z.object({
        hash: z.string().min(1),
        name: z.string().min(1).optional(),
        position: positionInput.optional(),
        size: sizeInput.optional(),
        options: z.record(z.string(), z.unknown()).optional(),
      }),
      run: ({ hash, name, position, size, options }) => {
        const widget = widgetOrThrow(hash)
        if (options !== undefined && widgetsWithProtectedOptions.includes(widget.component)) {
          throw new Error(`The options of ${widget.component} widgets cannot be changed by an agent.`)
        }
        if (name !== undefined) widget.name = name
        if (position !== undefined) widget.position = position
        if (size !== undefined) widget.size = size
        if (options !== undefined) Object.assign(widget.options, options)
        return { updated: hash }
      },
    }),
    defineMcpTool({
      name: 'list_mini_widget_containers',
      title: 'List mini-widget containers',
      description:
        'List the mini-widget containers a view shows, with the mini-widgets in each: the top bar shared by ' +
        'every view, the bottom bar of the view, and its floating mini-widget bars.',
      readOnly: true,
      runsCode: false,
      input: z.object({ viewHash: viewHashInput }),
      run: ({ viewHash }) => {
        return miniWidgetContainersOf(viewOrThrow(viewHash)).map((container) => ({
          name: container.name,
          miniWidgets: container.widgets.map(({ hash, component, name }) => ({ hash, component, name })),
        }))
      },
    }),
    defineMcpTool({
      name: 'add_mini_widget',
      title: 'Add mini-widget',
      description: 'Add a mini-widget, with its default options, to the end of a mini-widget container.',
      readOnly: false,
      runsCode: false,
      input: z.object({
        viewHash: viewHashInput,
        container: z.string().min(1).describe('Container name, from list_mini_widget_containers'),
        component: z.enum(MiniWidgetType),
      }),
      run: ({ viewHash, container, component }) => {
        const miniWidget: MiniWidget = { hash: uuid4(), component, name: component, options: {} }
        miniWidgetContainerOrThrow(viewOrThrow(viewHash), container).widgets.push(miniWidget)
        return { hash: miniWidget.hash }
      },
    }),
    defineMcpTool({
      name: 'move_mini_widget',
      title: 'Move mini-widget',
      description: 'Move a mini-widget to another container on the same view, or to another place in its own.',
      readOnly: false,
      runsCode: false,
      input: z.object({
        viewHash: viewHashInput,
        hash: z.string().min(1),
        container: z.string().min(1).describe('Container name, from list_mini_widget_containers'),
        index: z.number().int().min(0).optional().describe('Position in the container. Defaults to the end'),
      }),
      run: ({ viewHash, hash, container, index }) => {
        const view = viewOrThrow(viewHash)
        const source = miniWidgetContainersOf(view).find((c) => c.widgets.some((w) => w.hash === hash))
        if (source === undefined) throw new Error(`No mini-widget with hash '${hash}' on view '${view.hash}'.`)
        const target = miniWidgetContainerOrThrow(view, container)
        const [miniWidget] = source.widgets.splice(
          source.widgets.findIndex((w) => w.hash === hash),
          1
        )
        target.widgets.splice(index ?? target.widgets.length, 0, miniWidget)
        return { moved: hash }
      },
    }),
    defineMcpTool({
      name: 'add_view',
      title: 'Add view',
      description: 'Add an empty view and switch the operator to it.',
      readOnly: false,
      runsCode: false,
      input: z.object({ name: z.string().min(1).optional() }),
      run: ({ name }) => {
        widgetStore.addView()
        const view = widgetStore.currentView
        if (name !== undefined) view.name = name
        return { hash: view.hash, name: view.name }
      },
    }),
    defineMcpTool({
      name: 'rename_view',
      title: 'Rename view',
      description: 'Rename a view.',
      readOnly: false,
      runsCode: false,
      input: z.object({ viewHash: z.string().min(1), name: z.string().min(1) }),
      run: ({ viewHash, name }) => {
        viewOrThrow(viewHash).name = name
        return { renamed: viewHash }
      },
    }),
    defineMcpTool({
      name: 'select_view',
      title: 'Select view',
      description: 'Switch the operator to a view.',
      readOnly: false,
      runsCode: false,
      input: z.object({ viewHash: z.string().min(1) }),
      run: ({ viewHash }) => {
        const view = viewOrThrow(viewHash)
        if (!view.visible) throw new Error(`View '${viewHash}' is hidden, so it cannot be selected.`)
        widgetStore.selectView(view)
        return { selected: viewHash }
      },
    }),
  ]
}

const poiTools = (): McpTool[] => {
  const { pointsOfInterest, applyExternalPoiCommand } = usePointsOfInterest()

  return [
    defineMcpTool({
      name: 'list_points_of_interest',
      title: 'List points of interest',
      description:
        'List the points of interest on the map. A string latitude, longitude or heading is a live data-lake ' +
        'expression rather than a fixed value.',
      readOnly: true,
      runsCode: false,
      input: z.object({}),
      run: () => pointsOfInterest.value,
    }),
    defineMcpTool({
      name: 'add_point_of_interest',
      title: 'Add point of interest',
      description: 'Add a point of interest to the map, under an id you choose to update or remove it later.',
      readOnly: false,
      runsCode: false,
      input: externalPoiSchema,
      run: (poi) => {
        applyExternalPoiCommand({ type: 'cockpit:addPointOfInterest', poi })
        return { added: poi.id }
      },
    }),
    defineMcpTool({
      name: 'update_point_of_interest',
      title: 'Update point of interest',
      description:
        'Change the given fields of a point of interest, leaving the others as they are. Latitude and longitude ' +
        'are sent together, and replace any live expression with a fixed position.',
      readOnly: false,
      runsCode: false,
      input: externalPoiUpdateSchema,
      run: (poi) => {
        applyExternalPoiCommand({ type: 'cockpit:updatePointOfInterest', poi })
        return { updated: poi.id }
      },
    }),
    defineMcpTool({
      name: 'remove_point_of_interest',
      title: 'Remove point of interest',
      description: 'Remove a point of interest from the map.',
      readOnly: false,
      runsCode: false,
      input: z.object({ id: externalPoiIdSchema }),
      run: ({ id }) => {
        applyExternalPoiCommand({ type: 'cockpit:removePointOfInterest', id })
        return { removed: id }
      },
    }),
  ]
}

/**
 * Offer Cockpit's tools to agents through the MCP server that the Electron main process runs
 */
export const useMcpBridge = (): void => {
  const api = window.electronAPI
  if (!isElectron() || api === undefined) return

  const tools: McpTool[] = [...libMcpTools, ...widgetTools(), ...poiTools()]

  const handleCall = async ({ callId, name, args }: McpToolCall): Promise<void> => {
    const tool = tools.find((t) => t.name === name)
    try {
      if (tool === undefined) throw new Error(`Unknown tool '${name}'.`)
      // Round-tripped through JSON so reactive proxies, which IPC cannot clone, reach the agent as plain data.
      const result = JSON.parse(JSON.stringify((await tool.run(args)) ?? null))
      api.sendMcpToolResult({ callId, result })
      if (!tool.readOnly) openSnackbar({ message: `An agent changed Cockpit: ${tool.title}.`, variant: 'info' })
    } catch (error) {
      api.sendMcpToolResult({ callId, error: errorMessage(error) })
    }
  }

  const stopListening = api.onMcpToolCall((call) => void handleCall(call))
  api.registerMcpTools(tools.map(mcpToolDefinition)).catch((error) => {
    console.error('Could not offer the Cockpit tools to agents.', error)
  })

  onBeforeUnmount(stopListening)
}
