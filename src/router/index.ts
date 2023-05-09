import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

import AboutViewVue from '../views/AboutView.vue'
import MissionPlanningView from '../views/MissionPlanningView.vue'
import WidgetsView from '../views/WidgetsView.vue'

const router = createRouter({
  history: process.env.IS_ELECTRON
    ? createWebHistory(import.meta.env.BASE_URL)
    : createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'widgets-view',
      component: WidgetsView,
    },
    {
      path: '/mission-planning',
      name: 'Mission planning',
      component: MissionPlanningView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutViewVue,
    },
  ],
})

export default router
