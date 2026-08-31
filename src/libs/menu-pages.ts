import { SubMenuComponentName, SubMenuName } from '@/types/general'

/**
 * A page reachable from the main menu, listed in one of its sub-menus and addressable by its own route.
 */
export interface MenuPage {
  /**
   * Sub-menu the page is listed under.
   */
  subMenu: SubMenuName
  /**
   * Path segment identifying the page inside its sub-menu, as in `/settings/<slug>`.
   */
  slug: string
  /**
   * Label shown for the page in the main menu.
   */
  title: string
  /**
   * Material Design Icons name shown for the page in the main menu.
   */
  icon: string
  /**
   * Whether the page is only listed while pirate mode is on.
   */
  pirateModeOnly?: boolean
}

/**
 * A {@link MenuPage} paired with the name that identifies it across the menu, the router and the store.
 */
export interface MenuPageEntry extends MenuPage {
  /**
   * Name identifying the page.
   */
  componentName: SubMenuComponentName
}

/**
 * Every page the main menu can open, in the order the sub-menus list them.
 *
 * Being keyed by `SubMenuComponentName` keeps the enum the single source of truth for the page list: a new member
 * does not compile until it is described here, and from here both the routes and the menu entries are built.
 */
export const menuPages: Record<SubMenuComponentName, MenuPage> = {
  [SubMenuComponentName.SettingsGeneral]: {
    subMenu: SubMenuName.settings,
    slug: 'general',
    title: 'General',
    icon: 'mdi-view-dashboard-variant',
  },
  [SubMenuComponentName.SettingsInterface]: {
    subMenu: SubMenuName.settings,
    slug: 'interface',
    title: 'Interface',
    icon: 'mdi-monitor-cellphone',
  },
  [SubMenuComponentName.SettingsJoystick]: {
    subMenu: SubMenuName.settings,
    slug: 'joystick',
    title: 'Joystick',
    icon: 'mdi-controller',
  },
  [SubMenuComponentName.SettingsVideo]: {
    subMenu: SubMenuName.settings,
    slug: 'video',
    title: 'Video',
    icon: 'mdi-video',
  },
  [SubMenuComponentName.SettingsTelemetry]: {
    subMenu: SubMenuName.settings,
    slug: 'telemetry',
    title: 'Telemetry',
    icon: 'mdi-subtitles-outline',
  },
  [SubMenuComponentName.SettingsAlerts]: {
    subMenu: SubMenuName.settings,
    slug: 'alerts',
    title: 'Alerts',
    icon: 'mdi-alert-rhombus-outline',
  },
  [SubMenuComponentName.SettingsDev]: {
    subMenu: SubMenuName.settings,
    slug: 'dev',
    title: 'Dev',
    icon: 'mdi-dev-to',
  },
  [SubMenuComponentName.SettingsMission]: {
    subMenu: SubMenuName.settings,
    slug: 'mission',
    title: 'Mission',
    icon: 'mdi-map-marker-path',
  },
  [SubMenuComponentName.SettingsActions]: {
    subMenu: SubMenuName.settings,
    slug: 'actions',
    title: 'Actions',
    icon: 'mdi-run-fast',
  },
  [SubMenuComponentName.SettingsSources]: {
    subMenu: SubMenuName.settings,
    slug: 'sources',
    title: 'Sources',
    icon: 'mdi-import',
  },
  [SubMenuComponentName.SettingsMAVLink]: {
    subMenu: SubMenuName.settings,
    slug: 'mavlink',
    title: 'MAVLink',
    icon: 'mdi-protocol',
    pirateModeOnly: true,
  },
  [SubMenuComponentName.SettingsCloud]: {
    subMenu: SubMenuName.settings,
    slug: 'cloud',
    title: 'Cloud',
    icon: 'mdi-cloud-outline',
    pirateModeOnly: true,
  },
  [SubMenuComponentName.ToolsMAVLink]: {
    subMenu: SubMenuName.tools,
    slug: 'mavlink',
    title: 'MAVLink',
    icon: 'mdi-protocol',
  },
  [SubMenuComponentName.ToolsDataLake]: {
    subMenu: SubMenuName.tools,
    slug: 'data-lake',
    title: 'Data-lake',
    icon: 'mdi-database-outline',
  },
  [SubMenuComponentName.ToolsLogs]: {
    subMenu: SubMenuName.tools,
    slug: 'logs',
    title: 'Data Logs',
    icon: 'mdi-file-chart-outline',
  },
  [SubMenuComponentName.ToolsMap]: {
    subMenu: SubMenuName.tools,
    slug: 'map',
    title: 'Map',
    icon: 'mdi-map-marker-radius',
  },
}

// The destinations that are not pages of a sub-menu still need their address held in one place, since the router and
// the navigation helpers have to agree on it.
export const aboutSlug = 'about'
export const editModeSlug = 'edit'

const menuPageEntries = Object.entries(menuPages).map(([componentName, page]) => ({
  componentName: componentName as SubMenuComponentName,
  ...page,
}))

/**
 * Lists the pages of a sub-menu, in the order the menu shows them.
 * @param {SubMenuName} subMenu - Sub-menu to list the pages of.
 * @param {boolean} includePirateModePages - Whether pages that are only available in pirate mode should be listed.
 * @returns {MenuPageEntry[]} The pages of the given sub-menu.
 */
export const menuPagesOfSubMenu = (subMenu: SubMenuName, includePirateModePages: boolean): MenuPageEntry[] => {
  return menuPageEntries.filter(
    (entry) => entry.subMenu === subMenu && (includePirateModePages || !entry.pirateModeOnly)
  )
}

// Pages of one sub-menu sharing a slug would become sibling routes with the same path, of which only the first could
// ever match, leaving the other silently unreachable. Failing here instead makes that impossible rather than unlikely.
Object.values(SubMenuName).forEach((subMenu) => {
  const slugs = menuPagesOfSubMenu(subMenu, true).map((page) => page.slug)
  if (new Set(slugs).size !== slugs.length) {
    throw new Error(`Pages of the '${subMenu}' sub-menu need unique slugs, but got: ${slugs.join(', ')}.`)
  }
})
