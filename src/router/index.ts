import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'

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
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
