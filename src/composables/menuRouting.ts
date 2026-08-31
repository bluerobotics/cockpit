import { type ComputedRef, computed, onBeforeUnmount, watch } from 'vue'
import { type RouteRecordName, useRoute } from 'vue-router'

import { openMainMenuIfSafeOrDesired } from '@/composables/armSafetyDialog'
import { openSnackbar } from '@/composables/snackbar'
import { aboutSlug, menuPages } from '@/libs/menu-pages'
import router from '@/router'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { SubMenuComponentName, SubMenuName } from '@/types/general'

// The menu follows the address, rather than the other way around: every entry point below pushes a route, and
// `useMenuRouteSync` is the only thing that writes the menu state the interface renders from. That keeps a page
// reachable by URL and stops the address from disagreeing with what is on screen.
//
// Navigating is left unlogged, since a destination is reached from places that each describe the interaction in their
// own terms. The exceptions are the menu's own open and close actions, which mean the same thing wherever they are
// triggered from and so carry their log line here, and a navigation no caller asked for, which only the browser's
// back and forward buttons produce.

const navigate = (path: string, replace: boolean): void => {
  if (replace) {
    router.replace(path)
    return
  }
  router.push(path)
}

const baseViewPath = (): string => router.currentRoute.value.matched[0]?.path ?? '/'

const menuPath = (...segments: string[]): string => {
  const basePath = baseViewPath()
  return `${basePath === '/' ? '' : basePath}/${segments.join('/')}`
}

const activePage = (): SubMenuComponentName | undefined => router.currentRoute.value.meta.menuPage

const activeSubMenu = (): SubMenuName | undefined => router.currentRoute.value.meta.subMenu

/**
 * Opens a page of the main menu, over the view currently being shown.
 * @param {SubMenuComponentName} page - Page to open.
 * @param {boolean} replace - Whether to replace the current address instead of adding one to the history, for a
 * destination the interface restores on the user's behalf rather than one they asked for.
 */
export const goToMenuPage = (page: SubMenuComponentName, replace = false): void => {
  navigate(menuPath(menuPages[page].subMenu, menuPages[page].slug), replace)
}

/**
 * Lists the pages of a sub-menu in the main menu, closing any page open over the view.
 * @param {SubMenuName} subMenu - Sub-menu to open.
 * @param {boolean} replace - Whether to replace the current address instead of adding one to the history.
 */
export const goToSubMenu = (subMenu: SubMenuName, replace = false): void => {
  navigate(menuPath(subMenu), replace)
}

/**
 * Opens the About dialog.
 */
export const goToAbout = (): void => {
  navigate(menuPath(aboutSlug), false)
}

/**
 * Leaves whatever menu destination is open, back to the plain view it was layered over.
 * @param {boolean} replace - Whether to replace the current address instead of adding one to the history.
 */
export const goToBaseView = (replace = false): void => {
  navigate(baseViewPath(), replace)
}

/**
 * Closes the open page, leaving the sub-menu it belongs to listed.
 */
export const closeMenuPage = (): void => {
  const page = activePage()
  const subMenu = activeSubMenu()
  if (subMenu === undefined) return
  if (page !== undefined) logUserAction(`Closed '${menuPages[page].title}' panel`)
  goToSubMenu(subMenu)
}

/**
 * Opens a page from the main menu, or closes it when it is the one already open.
 * @param {SubMenuComponentName} page - Page to toggle.
 */
export const toggleMenuPage = (page: SubMenuComponentName): void => {
  if (activePage() === page) {
    closeMenuPage()
    return
  }
  logUserAction(`Opened '${menuPages[page].title}' panel`)
  goToMenuPage(page)
}

/**
 * Reads the menu destination the current address stands for.
 * @returns {object} The view being shown, the sub-menu listed, the page open over it, and whether About is open.
 */
export const useActiveMenuRoute = (): {
  /**
   * Name of the view the menu is layered over, regardless of which destination is open over it.
   */
  baseRouteName: ComputedRef<RouteRecordName | undefined>
  /**
   * Sub-menu whose pages are listed, if any.
   */
  activeSubMenu: ComputedRef<SubMenuName | undefined>
  /**
   * Page open over the view, if any.
   */
  activeMenuPage: ComputedRef<SubMenuComponentName | undefined>
  /**
   * Whether the About dialog is open.
   */
  isAboutOpen: ComputedRef<boolean>
} => {
  const route = useRoute()

  return {
    baseRouteName: computed(() => route.matched[0]?.name),
    activeSubMenu: computed(() => route.meta.subMenu),
    activeMenuPage: computed(() => route.meta.menuPage),
    isAboutOpen: computed(() => route.meta.about === true),
  }
}

/**
 * Keeps the main menu showing whatever the address names, and the address naming whatever the main menu shows.
 *
 * Meant to be set up once, by the component that owns the main menu.
 */
export const useMenuRouteSync = (): void => {
  const route = useRoute()
  const interfaceStore = useAppInterfaceStore()

  // Back and forward reach every destination the helpers do, and are the one way in with no caller to log it. The
  // history's own listener tells them apart, since it is notified on a popped state and on nothing else.
  const stopHistoryLogging = router.options.history.listen((to) => {
    logUserAction(`Navigated with the browser history to '${to}'`)
  })

  const stopRouteSync = watch(
    () => route.path,
    () => {
      const page = route.meta.menuPage
      if (page !== undefined && menuPages[page].pirateModeOnly === true && !interfaceStore.pirateMode) {
        goToBaseView(true)
        openSnackbar({
          message: `'${menuPages[page].title}' is only available with pirate mode on.`,
          variant: 'warning',
          duration: 5000,
          action: { label: 'General settings', handler: () => goToMenuPage(SubMenuComponentName.SettingsGeneral) },
        })
        return
      }

      if (route.meta.subMenu === undefined) {
        interfaceStore.mainMenuCurrentStep = 1
        return
      }

      interfaceStore.mainMenuCurrentStep = 2
      if (!interfaceStore.isMainMenuVisible) openMainMenuIfSafeOrDesired()
    },
    { immediate: true }
  )

  // A sub-menu cannot be shown by a menu that is closed, so dismissing it takes the address back to the plain view.
  // The address is replaced rather than pushed, since a menu hidden to make room for another surface never navigated
  // anywhere, and the entry a push would mint is one back would walk into.
  const stopMenuVisibilitySync = watch(
    () => interfaceStore.isMainMenuVisible,
    (isVisible) => {
      if (!isVisible && route.meta.subMenu !== undefined) goToBaseView(true)
    }
  )

  onBeforeUnmount(() => {
    stopHistoryLogging()
    stopRouteSync()
    stopMenuVisibilitySync()
  })
}
