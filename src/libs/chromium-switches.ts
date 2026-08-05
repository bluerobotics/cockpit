import { Platform } from '@/types/platform'

/**
 * Chromium command-line switches that Cockpit Standalone can apply at launch, used to work around GPU and video
 * driver bugs that only show up on specific hardware.
 *
 * Whether a switch actually exists is deliberately not checked: Chromium ignores switches it does not recognize, so a
 * typo is harmless, while a perfectly valid switch can still break rendering. Startup is protected by the boot
 * failsafe in the GPU service rather than by validation here.
 */

/** A Chromium command-line switch, stripped of its leading dashes. */
export interface ChromiumSwitch {
  /**
   * Switch name, e.g. "disable-zero-copy-dxgi-video"
   */
  name: string
  /**
   * Value for switches that take one, e.g. "gl" for "use-angle=gl"
   */
  value?: string
}

/** A curated switch offered in the advanced initialization options. */
export interface PredefinedChromiumSwitch {
  /**
   * The switch exactly as it is applied, e.g. "enable-features=D3D11VideoDecoderAlwaysCopy"
   */
  entry: string
  /**
   * Short label shown to the user
   */
  title: string
  /**
   * What the switch does and which problem it usually helps with
   */
  description: string
  /**
   * Platforms where the switch has any effect
   */
  platforms: Platform[]
}

const allPlatforms = [Platform.WINDOWS, Platform.MACOS, Platform.LINUX]

/**
 * Switches that would weaken Cockpit's security or reliably destabilize it, so they cannot be added by hand.
 */
export const blockedChromiumSwitchNames = [
  'allow-running-insecure-content',
  'disable-web-security',
  'in-process-gpu',
  'inspect',
  'js-flags',
  'no-sandbox',
  'remote-debugging-pipe',
  'remote-debugging-port',
  'single-process',
  'user-data-dir',
]

export const predefinedChromiumSwitches: PredefinedChromiumSwitch[] = [
  {
    entry: 'disable-zero-copy-dxgi-video',
    title: 'Copy video frames instead of sharing them',
    description:
      'Stops the video decoder from writing straight into shared graphics memory. This is the first thing to try ' +
      'when video freezes or drops to zero frames per second on Windows, and it keeps hardware decoding enabled.',
    platforms: [Platform.WINDOWS],
  },
  {
    entry: 'enable-features=D3D11VideoDecoderAlwaysCopy',
    title: 'Force the video decoder to copy every frame',
    description:
      'Applies the same fix as the option above, from the decoder side instead of the graphics side. Worth trying ' +
      'when video still stalls with multiple streams open.',
    platforms: [Platform.WINDOWS],
  },
  {
    entry: 'disable-direct-composition-video-overlays',
    title: 'Disable Windows video overlays',
    description:
      'Draws video through the normal rendering path instead of a hardware overlay. Helps with black, torn or ' +
      'flickering video areas on some graphics drivers.',
    platforms: [Platform.WINDOWS],
  },
  {
    entry: 'use-angle=gl',
    title: 'Render through OpenGL instead of Direct3D',
    description:
      'Replaces the Direct3D renderer with OpenGL, which can recover video that no other option fixes. Chromium ' +
      'does not officially support this on Windows, so instruments and the map may show visual glitches. Last resort.',
    platforms: [Platform.WINDOWS],
  },
  {
    entry: 'enable-features=VaapiVideoDecodeLinuxGL',
    title: 'Enable hardware video decoding on Linux',
    description:
      'Turns on GPU video decoding, which Chromium leaves off by default on Linux. Reduces processor load when ' +
      'several streams are open, as long as the system has working VA-API drivers.',
    platforms: [Platform.LINUX],
  },
  {
    entry: 'disable-accelerated-video-decode',
    title: 'Decode video on the processor',
    description:
      'Bypasses the graphics card for video decoding entirely. Reliable when the graphics driver is at fault, but it ' +
      'uses noticeably more processor time and battery.',
    platforms: allPlatforms,
  },
  {
    entry: 'ignore-gpu-blocklist',
    title: 'Use the graphics card even if it is blocked',
    description:
      'Forces graphics acceleration on when Chromium has disabled it for your driver. Can restore smooth video and ' +
      'instruments on older hardware, at the risk of instability.',
    platforms: allPlatforms,
  },
  {
    entry: 'disable-gpu',
    title: 'Disable graphics acceleration',
    description:
      'Renders everything on the processor. Use only when Cockpit shows a blank or corrupted window on startup, as ' +
      'video and instruments will run slowly.',
    platforms: allPlatforms,
  },
]

const switchNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Parse Chromium command-line switches from a persisted list or a whitespace-separated string.
 * Entries are separated by whitespace only, as values like "enable-features=A,B" are comma-separated themselves.
 * @param {string | string[] | undefined} input Switch entries, with or without leading dashes
 * @returns {ChromiumSwitch[]} Parsed switches, skipping entries without a name
 */
export const parseChromiumSwitches = (input: string | string[] | undefined): ChromiumSwitch[] => {
  const entries = typeof input === 'string' ? input.split(/\s+/) : input ?? []
  return entries
    .map((entry) => {
      const normalized = entry.trim().replace(/^-+/, '')
      const separatorIndex = normalized.indexOf('=')
      if (separatorIndex === -1) return { name: normalized }
      return { name: normalized.slice(0, separatorIndex), value: normalized.slice(separatorIndex + 1) }
    })
    .filter(({ name }) => name !== '')
}

/**
 * Check a switch typed by the user, rejecting entries that are malformed or unsafe to apply.
 * @param {string} entry Switch as typed, with or without leading dashes
 * @returns {string | undefined} Reason the entry cannot be used, or undefined when it is acceptable
 */
export const validateChromiumSwitchEntry = (entry: string): string | undefined => {
  const trimmed = entry.trim()
  if (/\s/.test(trimmed)) return 'Add one switch at a time, without spaces.'

  const [parsed] = parseChromiumSwitches([trimmed])
  if (parsed === undefined) return 'Type the name of a switch, such as disable-gpu.'
  if (!switchNamePattern.test(parsed.name)) return 'Switch names only use lowercase letters, numbers and dashes.'
  if (blockedChromiumSwitchNames.includes(parsed.name)) {
    return `"${parsed.name}" is not allowed, as it would weaken Cockpit's security or stability.`
  }

  return undefined
}
