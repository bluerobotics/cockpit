import camelcaseKeys from 'camelcase-keys'
import { z } from 'zod'

import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { customActionTypes, HttpRequestMethod } from '@/types/cockpit-actions'
import { CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'

/**
 * Converts a string from camelCase, snake_case, or PascalCase to kebab-case
 * @param {string} str The string to convert
 * @returns {string} The string in kebab-case
 */
const toKebabCase = (str: string): string => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Creates a preprocessing Zod schema that converts all keys to camelCase before validation
 * @param {z.ZodTypeAny} schema The Zod schema to convert
 * @returns {z.ZodTypeAny} The converted Zod schema
 */
const preprocessCamelCase = <T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny => {
  return z.preprocess((val: Record<string, unknown>) => camelcaseKeys(val, { deep: true }), schema)
}

/**
 * Creates a preprocessing Zod schema that fills canonical camelCase keys from legacy snake_case aliases.
 * Only the listed keys are remapped (existing camelCase values win).
 * @param {Record<string, string>} aliases Map of legacy snake_case key to canonical camelCase key
 * @param {T} schema The Zod schema to validate against after remapping
 * @returns {z.ZodTypeAny} The schema wrapped with alias preprocessing
 */
const withLegacyAliases = <T extends z.ZodTypeAny>(aliases: Record<string, string>, schema: T): z.ZodTypeAny => {
  return z.preprocess((val) => {
    if (typeof val !== 'object' || val === null) return val
    const obj = { ...(val as Record<string, unknown>) }
    for (const [legacyKey, canonicalKey] of Object.entries(aliases)) {
      if (obj[canonicalKey] === undefined && obj[legacyKey] !== undefined) {
        obj[canonicalKey] = obj[legacyKey]
      }
    }
    return obj
  }, schema)
}

// Zod schemas for external API responses
const ServiceMetadataSchema = z
  .object({
    extras: z
      .object({
        cockpit: z.string().optional(),
      })
      .nullish(),
    worksInRelativePaths: z.boolean().nullish(),
    sanitizedName: z.string().optional(),
  })
  .nullish()

export const ServiceSchema = preprocessCamelCase(
  z.object({
    metadata: ServiceMetadataSchema,
    port: z.number().optional(),
  })
)

const ExternalWidgetSetupInfoSchema = withLegacyAliases(
  { iframe_url: 'iframeUrl', iframe_icon: 'iframeIcon', icon_url: 'iconUrl' },
  z
    .object({
      name: z.string(),
      iframeUrl: z.string(),
      iconUrl: z.string().optional(),
      iframeIcon: z.string().optional(),
      collapsibleContainerName: z.string().optional(),
      version: z.string().optional(),
      startCollapsed: z.boolean().optional(),
      useExtensionPathAsBaseUrl: z.boolean().optional(),
    })
    .refine((data) => data.iconUrl !== undefined || data.iframeIcon !== undefined, {
      message: 'Either iconUrl or iframeIcon must be provided',
    })
)

const HttpRequestActionConfigSchema = z.object({
  name: z.string(),
  url: z.string(),
  method: z.enum(HttpRequestMethod),
  headers: z.record(z.string(), z.string()),
  urlParams: z.record(z.string(), z.string()).default({}),
  body: z.string(),
})

const MavlinkMessageActionConfigSchema = z.object({
  name: z.string(),
  messageType: z.enum(MAVLinkType),
  messageConfig: z.any(),
})

const JavascriptActionConfigSchema = z.object({
  name: z.string(),
  code: z.string(),
})

const ActionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(customActionTypes),
  config: z.union([HttpRequestActionConfigSchema, MavlinkMessageActionConfigSchema, JavascriptActionConfigSchema]),
  version: z.string().optional(),
})

const JoystickButtonMappingSuggestionSchema = z
  .object({
    id: z.string(),
    actionProtocol: z.string().transform((val) => toKebabCase(val) as JoystickProtocol),
    actionName: z.string(),
    actionId: z.string(),
    button: z.number(),
    modifierKey: z.enum(CockpitModifierKeyOption),
    description: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    modifier: data.modifierKey,
    modifierKey: undefined as never,
  }))

const JoystickMapSuggestionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  buttonMappingSuggestions: z.array(JoystickButtonMappingSuggestionSchema),
  targetVehicleTypes: z.array(z.string()).optional(),
  version: z.string().optional(),
})

export const ExtrasJsonSchema = withLegacyAliases(
  {
    target_cockpit_api_version: 'targetCockpitApiVersion',
    target_system: 'targetSystem',
    joystick_suggestions: 'joystickSuggestions',
  },
  z.object({
    targetCockpitApiVersion: z.string(),
    targetSystem: z.string(),
    widgets: z.array(ExternalWidgetSetupInfoSchema).default([]),
    actions: z.array(ActionConfigSchema).default([]),
    joystickSuggestions: z.array(JoystickMapSuggestionGroupSchema).optional(),
  })
)
