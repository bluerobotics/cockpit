import camelcaseKeys from 'camelcase-keys'
import { z } from 'zod'

import { HttpRequestMethod } from '@/libs/actions/http-request'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { customActionTypes } from '@/libs/joystick/protocols/cockpit-actions'
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

// Zod schemas for external API responses
const ServiceMetadataSchema = z
  .object({
    extras: z
      .object({
        cockpit: z.string().optional(),
      })
      .nullish(),
    worksInRelativePaths: z.boolean().optional(),
    sanitizedName: z.string().optional(),
  })
  .nullish()

export const ServiceSchema = preprocessCamelCase(
  z.object({
    metadata: ServiceMetadataSchema,
    port: z.number().optional(),
  })
)

const ExternalWidgetSetupInfoSchema = z.object({
  name: z.string(),
  iframeUrl: z.string(),
  iframeIcon: z.string(),
})

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
  buttonMappingSuggestions: z.array(JoystickButtonMappingSuggestionSchema),
  version: z.string().optional(),
})

export const ExtrasJsonSchema = preprocessCamelCase(
  z.object({
    targetCockpitApiVersion: z.string(),
    targetSystem: z.string(),
    widgets: z.array(ExternalWidgetSetupInfoSchema).default([]),
    actions: z.array(ActionConfigSchema).default([]),
    joystickSuggestions: z.array(JoystickMapSuggestionGroupSchema).optional(),
  })
)
