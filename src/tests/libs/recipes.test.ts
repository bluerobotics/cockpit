import { describe, expect, it, vi } from 'vitest'

import {
  emptyRecipe,
  missingDependencies,
  parseRecipe,
  pickRecipeItems,
  recipeDependencies,
  recipeItems,
  withDependencies,
} from '@/libs/recipes'
import { customActionTypes, HttpRequestMethod } from '@/types/cockpit-actions'
import type { CockpitRecipe } from '@/types/recipes'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: vi.fn(), setKeyValue: vi.fn() },
}))

const sampleRecipe = (): CockpitRecipe => ({
  ...emptyRecipe('Depth alarm', 'Warns when too deep'),
  dataLakeVariables: [
    { variable: { id: 'user/custom/depth-limit', name: 'Depth limit', type: 'number', persistValue: true }, value: 30 },
    { variable: { id: 'user/custom/unused', name: 'Unused', type: 'string' } },
  ],
  compoundVariables: [
    {
      id: 'user/custom/too-deep',
      name: 'Too deep',
      type: 'boolean',
      expression: '{{ depth }} > {{ user/custom/depth-limit }}',
    },
  ],
  actions: [
    {
      id: 'http-request-action (Notify)',
      type: customActionTypes.httpRequest,
      config: {
        name: 'Notify',
        url: 'http://example.com/{{ user/custom/too-deep }}',
        method: HttpRequestMethod.GET,
        headers: {},
        urlParams: {},
        body: '',
      },
      link: { variables: ['user/custom/unused'], minInterval: 100 },
      autoRun: { type: 'interval', delayMs: 5000 },
    },
    {
      id: 'javascript-action (Alarm)',
      type: customActionTypes.javascript,
      config: { name: 'Alarm', code: "cockpit.executeActionCallback('http-request-action (Notify)')" },
    },
  ],
  websocketConnections: ['ws://{{ vehicle-address }}:1234'],
  diyWidgets: [
    {
      id: 'depth-panel',
      template: {
        name: 'Depth panel',
        html: '<div></div>',
        css: '',
        js: "cockpit.listenDataLakeVariable('user/custom/too-deep', () => {})",
        inheritCockpitStyles: true,
        scopedScript: true,
      },
    },
  ],
})

describe('parseRecipe', () => {
  it('reads back a recipe it wrote', () => {
    const recipe = sampleRecipe()
    expect(parseRecipe(JSON.stringify(recipe))).toEqual({ recipe, droppedEntries: 0 })
  })

  it('refuses files that are not recipes, or that a newer Cockpit made', () => {
    expect(() => parseRecipe('not json')).toThrow('not valid JSON')
    expect(() => parseRecipe('{"name": "views"}')).toThrow('not a Cockpit recipe')
    expect(() => parseRecipe(JSON.stringify({ ...sampleRecipe(), version: 2 }))).toThrow('newer version')
  })

  it('leaves out malformed entries and keeps the rest', () => {
    const file = {
      ...sampleRecipe(),
      actions: [
        ...sampleRecipe().actions,
        { id: 'x', type: 'javascript', config: { name: 'No code' } },
        { ...sampleRecipe().actions[1], autoRun: { type: 'interval', delayMs: 0 } },
      ],
      websocketConnections: ['', 42, 'ws://host:1'],
    }
    const { recipe, droppedEntries } = parseRecipe(JSON.stringify(file))
    expect(droppedEntries).toBe(4)
    expect(recipe.actions).toHaveLength(2)
    expect(recipe.websocketConnections).toEqual(['ws://host:1'])
  })

  it('drops fields the format does not know', () => {
    const file = { ...sampleRecipe(), diyWidgets: [{ ...sampleRecipe().diyWidgets[0], extra: 'field' }] }
    expect(parseRecipe(JSON.stringify(file)).recipe.diyWidgets[0]).not.toHaveProperty('extra')
  })
})

describe('recipeDependencies', () => {
  it('finds the variables and actions each entry needs', () => {
    expect(recipeDependencies(sampleRecipe())).toEqual({
      'data-lake:user/custom/too-deep': ['data-lake:user/custom/depth-limit'],
      'action:http-request-action (Notify)': ['data-lake:user/custom/unused', 'data-lake:user/custom/too-deep'],
      'action:javascript-action (Alarm)': ['action:http-request-action (Notify)'],
      'websocket:ws://{{ vehicle-address }}:1234': [],
      'diy-widget:depth-panel': ['data-lake:user/custom/too-deep'],
    })
  })
})

describe('pickRecipeItems', () => {
  it('keeps only the chosen entries', () => {
    const recipe = sampleRecipe()
    const picked = pickRecipeItems(recipe, ['data-lake:user/custom/too-deep', 'diy-widget:depth-panel'])
    expect(recipeItems(picked).map((item) => item.key)).toEqual([
      'data-lake:user/custom/too-deep',
      'diy-widget:depth-panel',
    ])
  })
})

describe('withDependencies and missingDependencies', () => {
  const dependencies = { a: ['b'], b: ['c'], c: [], d: ['c'] }

  it('adds what the items need, through other items too', () => {
    expect(withDependencies(['a'], dependencies).sort()).toEqual(['a', 'b', 'c'])
  })

  it('lists, per chosen item, what was left out', () => {
    expect(missingDependencies(['a', 'd'], dependencies)).toEqual({ a: ['b'], d: ['c'] })
    expect(missingDependencies(['a', 'b', 'c'], dependencies)).toEqual({})
  })
})
