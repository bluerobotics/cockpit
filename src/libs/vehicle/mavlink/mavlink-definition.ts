import definition from '@/libs/mavlink-json/message_definitions/v1.0/ardupilotmega.json'

/** Represents a parameter entry within an enum. */
export interface EnumEntryParam {
  /** Index of the enum entry. */
  index: string
  /** Description for this parameter (optional). */
  description?: string
}

/** Metadata for deprecated types, entries, or fields. */
export interface DeprecatedMetadata {
  /** Deprecated since version (optional). */
  since?: string
  /** Replacement identifier, if available (optional). */
  replaced_by?: string
  /** Additional deprecation notes (optional). */
  description?: string
}

/** Represents a single entry in a MAVLink enum. */
export interface EnumEntry {
  /** Enum entry name. */
  name: string
  /** Enum entry value. */
  value: number | string
  /** Description of the enum entry (optional). */
  description?: string
  /** List of parameter info for the entry (optional). */
  params?: EnumEntryParam[]
  /** Deprecation information for this entry (optional). */
  deprecated?: DeprecatedMetadata
  /** Whether this entry is work-in-progress (optional). */
  wip?: boolean
}

/** Defines an entire enum, including metadata and all entries. */
export interface EnumDefinition {
  /** Enum name. */
  name: string
  /** Description of the enum (optional). */
  description?: string
  /** All entries for this enum. */
  entries: EnumEntry[]
  /** Deprecation metadata for the enum (optional). */
  deprecated?: DeprecatedMetadata
  /** Whether this enum is work-in-progress (optional). */
  wip?: boolean
}

/** Specifies a single field in a MAVLink message. */
export interface MessageField {
  /** Field name. */
  name: string
  /** Field type (e.g. 'int32_t', 'float', 'uint8_t[4]'). */
  type: string
  /** Enum name if this field represents an enum value (optional). */
  enum?: string
  /** Field description (optional). */
  description?: string
  /** Field units (optional, e.g. 'm', 'degrees'). */
  units?: string
  /** True if this field is an extension (optional). */
  extension?: boolean
}

/** Complete definition for a single MAVLink message. */
export interface MessageDefinition {
  /** Name of the message. */
  name: string
  /** MAVLink message ID. */
  id: number
  /** Brief description of the message (optional). */
  description?: string
  /** List of all fields for the message. */
  fields: MessageField[]
  /** Deprecation details for the message (optional). */
  deprecated?: DeprecatedMetadata
  /** True if this message is work-in-progress (optional). */
  wip?: boolean
}

/** MAVLink definition root: contains all enums and all messages. */
export interface MAVLinkDefinition {
  /** All enum definitions. */
  enums: EnumDefinition[]
  /** All message definitions. */
  messages: MessageDefinition[]
}

/**
 * Singleton for loading and accessing the MAVLink JSON definition.
 * Handles async loading, instance caching, and provides convenience methods for definition lookup.
 */
class MAVLinkDefinitionSingleton {
  private static _instance: MAVLinkDefinitionSingleton
  private _definition: MAVLinkDefinition | null = null

  /**
   * Private constructor for Singleton pattern.
   */
  private constructor() {
    // This is a singleton baby
  }

  /**
   * Gets the singleton instance for accessing MAVLink definitions.
   * @returns {MAVLinkDefinitionSingleton} Instance for querying MAVLink definitions.
   */
  public static getInstance(): MAVLinkDefinitionSingleton {
    if (!MAVLinkDefinitionSingleton._instance) {
      MAVLinkDefinitionSingleton._instance = new MAVLinkDefinitionSingleton()
    }
    return MAVLinkDefinitionSingleton._instance
  }

  /**
   * Loads and caches the MAVLink definition from the ArduPilot Mega schema.
   * @returns {MAVLinkDefinition} Parsed MAVLink definition.
   */
  private loadDefinition(): MAVLinkDefinition {
    if (this._definition) {
      return this._definition
    }

    this._definition = definition as MAVLinkDefinition
    return this._definition
  }

  /**
   * Gets the full MAVLink definition object, loading it if necessary.
   * @returns {MAVLinkDefinition} The entire parsed MAVLink definition.
   */
  public definition(): MAVLinkDefinition {
    return this.loadDefinition()
  }

  /**
   * Finds an enum definition by its name.
   * @param {string} name Name of the enum.
   * @returns {EnumDefinition|undefined} The enum definition or undefined if not found.
   */
  public enum(name: string): EnumDefinition | undefined {
    return this.definition().enums.find((e) => e.name === name)
  }

  /**
   * Finds a message definition by its name.
   * @param {string} name Name of the message.
   * @returns {MessageDefinition|undefined} The message definition or undefined if not found.
   */
  public message(name: string): MessageDefinition | undefined {
    return this.definition().messages.find((m) => m.name === name)
  }

  /**
   * Finds a message definition by its message ID.
   * @param {number} id MAVLink message ID.
   * @returns {MessageDefinition|undefined} The message definition or undefined if not found.
   */
  public messageById(id: number): MessageDefinition | undefined {
    return this.definition().messages.find((m) => m.id === id)
  }

  /**
   * Finds an enum entry by the enum's name and the entry's name.
   * @param {string} enumName Name of the enum.
   * @param {string} entryName Name of the entry.
   * @returns {EnumEntry|undefined} The entry or undefined if not found.
   */
  public enumEntry(enumName: string, entryName: string): EnumEntry | undefined {
    return this.enum(enumName)?.entries.find((e) => e.name === entryName)
  }

  /**
   * Finds an enum entry by the enum's name and the entry's value.
   * @param {string} enumName Name of the enum.
   * @param {number|string} value Value of the entry.
   * @returns {EnumEntry|undefined} The entry or undefined if not found.
   */
  public enumEntryByValue(enumName: string, value: number | string): EnumEntry | undefined {
    return this.enum(enumName)?.entries.find((e) => e.value === value)
  }

  /**
   * Looks up a specific message field by message and field name.
   * @param {string} messageName Name of the message.
   * @param {string} fieldName Name of the field.
   * @returns {MessageField|undefined} The field or undefined if not found.
   */
  public messageField(messageName: string, fieldName: string): MessageField | undefined {
    return this.message(messageName)?.fields.find((f) => f.name === fieldName)
  }
}

export default MAVLinkDefinitionSingleton.getInstance()
