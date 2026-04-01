import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '工作台' } },
      { path: 'plan/list', component: () => import('../views/plan/PlanList.vue'), meta: { title: '我的计划' } },
      { path: 'plan/create', component: () => import('../views/plan/PlanForm.vue'), meta: { title: '新建计划' } },
      { path: 'plan/edit/:id', component: () => import('../views/plan/PlanForm.vue'), meta: { title: '编辑计划' } },
      { path: 'plan/detail/:id', component: () => import('../views/plan/PlanDetail.vue'), meta: { title: '计划详情' } },
      { path: 'plan/published', component: () => import('../views/plan/PublishedPlan.vue'), meta: { title: '已发布计划' } },
      { path: 'review/pending', component: () => import('../views/review/ReviewPending.vue'), meta: { title: '待我审核' } },
      { path: 'review/detail/:id', component: () => import('../views/review/ReviewDetail.vue'), meta: { title: '审核操作' } },
      { path: 'review/consolidated', component: () => import('../views/review/ReviewConsolidated.vue'), meta: { title: '整合审核', roles: ['DEPT_HEAD', 'OFFICE_HEAD', 'PRINCIPAL', 'ADMIN'] } },
      { path: 'feedback/list', component: () => import('../views/feedback/FeedbackList.vue'), meta: { title: '反馈管理' } },
      { path: 'feedback/plan/:planId', component: () => import('../views/feedback/FeedbackForm.vue'), meta: { title: '填写反馈' } },
      { path: 'system/users', component: () => import('../views/system/UserManage.vue'), meta: { title: '用户管理', roles: ['ADMIN'] } },
      { path: 'system/departments', component: () => import('../views/system/DeptManage.vue'), meta: { title: '部门管理', roles: ['ADMIN'] } },
      { path: 'system/config', component: () => import('../views/system/SystemConfig.vue'), meta: { title: '系统配置', roles: ['ADMIN'] } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.public) {
    if (token && to.path === '/login') return next('/dashboard')
    return next()
  }
  if (!token) return next('/login')
  next()
})

export default router
