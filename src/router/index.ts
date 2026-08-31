import { defineComponent } from 'vue'
import { type RouteRecordRaw, createRouter, createWebHashHistory } from 'vue-router'

import { aboutSlug, editModeSlug, menuPages } from '@/libs/menu-pages'
import { SubMenuComponentName, SubMenuName } from '@/types/general'

import MissionPlanningView from '../views/MissionPlanningView.vue'
import WidgetsView from '../views/WidgetsView.vue'

declare module 'vue-router' {
  /**
   * Menu destination each route stands for, so consumers can read it off the route instead of parsing its path.
   */
  interface RouteMeta {
    /**
     * Sub-menu the route belongs to, on the sub-menu route and on the routes of its pages.
     */
    subMenu?: SubMenuName
    /**
     * Page the route opens, on page routes only.
     */
    menuPage?: SubMenuComponentName
    /**
     * Whether the route opens the About dialog.
     */
    about?: true
    /**
     * Whether the route puts the interface in edit mode.
     */
    editMode?: true
  }
}

// Whatever a menu destination shows is drawn by `App.vue`, over the view the route is nested under, so these routes
// render nothing themselves. They still need a component to be matchable at all (vue-router's `isMatchable` takes a
// name, a component or a redirect), and sharing an empty one keeps every panel out of this module.
const rendersNothing = defineComponent({ render: () => null })

/**
 * Builds the routes the main menu destinations are addressed by, to be nested under each view they can be layered
 * over. The views render no `<router-view>` of their own, so these only deepen the address: matching them leaves the
 * view underneath mounted, and the menu opens the destination they name.
 * @param {string} basePath - Path of the view the routes are nested under, used to name them uniquely.
 * @returns {RouteRecordRaw[]} One route per sub-menu, holding one route per page, plus the About and edit routes.
 */
const menuRoutes = (basePath: string): RouteRecordRaw[] => {
  const prefix = basePath === '/' ? '' : basePath

  // A sub-menu route holds its pages and carries no panel of its own, so it needs a name to be matchable on its own.
  const subMenuRoutes = Object.values(SubMenuName).map((subMenu) => ({
    path: subMenu,
    name: `${prefix}/${subMenu}`,
    meta: { subMenu },
    children: Object.entries(menuPages)
      .filter(([, page]) => page.subMenu === subMenu)
      .map(([componentName, page]) => ({
        path: page.slug,
        component: rendersNothing,
        meta: { menuPage: componentName as SubMenuComponentName },
      })),
  }))

  return [
    ...subMenuRoutes,
    { path: aboutSlug, component: rendersNothing, meta: { about: true } },
    { path: editModeSlug, component: rendersNothing, meta: { editMode: true } },
  ]
}

const router = createRouter({
  // Standalone serves the interface from a `file://` URL, where a path-based history would make any reload or deep
  // link resolve to a file that does not exist. Hashing in both builds also keeps a shared link working in either one.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'widgets-view',
      component: WidgetsView,
      children: menuRoutes('/'),
    },
    {
      path: '/mission-planning',
      name: 'Mission planning',
      component: MissionPlanningView,
      children: menuRoutes('/mission-planning'),
    },
    {
      path: '/:unmatched(.*)*',
      redirect: '/',
    },
  ],
})

export default router
