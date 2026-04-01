<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo-area">
        <img v-if="!isCollapsed" src="https://p.ipic.vip/lmzked.jpg" alt="Logo" class="logo-img" />
        <img v-else src="https://p.ipic.vip/lmzked.jpg" alt="Logo" class="logo-img-collapsed" />
      </div>
      <el-menu
        :default-active="route.path"
        router
        :collapse="isCollapsed"
        background-color="#1e293b"
        text-color="#cbd5e1"
        active-text-color="#60a5fa"
        :collapse-transition="false"
      >
        <el-menu-item index="/dashboard">
          <el-icon><House /></el-icon>
          <template #title>工作台</template>
        </el-menu-item>

        <el-sub-menu index="/plan">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>计划管理</span>
          </template>
          <el-menu-item index="/plan/list">我的计划</el-menu-item>
          <el-menu-item index="/plan/published">已发布计划</el-menu-item>
        </el-sub-menu>

        <el-sub-menu
          index="/review"
          v-if="['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role)"
        >
          <template #title>
            <div style="display: flex; align-items: center; position: relative; width: 100%;">
              <el-icon><EditPen /></el-icon>
              <span>审核中心</span>
              <el-badge v-if="pendingCount > 0" :value="pendingCount" style="position: absolute; right: -8px; top: -5px;" />
            </div>
          </template>
          <el-menu-item index="/review/pending">列表审核</el-menu-item>
          <el-menu-item index="/review/consolidated">整合审核</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/feedback/list">
          <el-icon><ChatDotRound /></el-icon>
          <template #title>反馈管理</template>
        </el-menu-item>

        <el-sub-menu index="/system" v-if="role === 'ADMIN'">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/system/users">用户管理</el-menu-item>
          <el-menu-item index="/system/departments">部门管理</el-menu-item>
          <el-menu-item index="/system/config">系统配置</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="isCollapsed = !isCollapsed" :icon="isCollapsed ? Expand : Fold" />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta?.title || '' }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag type="primary" size="small">{{ ROLES[role] }}</el-tag>
          <span class="username">{{ userInfo?.real_name || userInfo?.realName }}</span>
          <el-button text @click="handleLogout" :icon="SwitchButton">退出</el-button>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox } from 'element-plus'
import { House, Document, EditPen, ChatDotRound, Setting, Fold, Expand, SwitchButton } from '@element-plus/icons-vue'
import { ROLES } from '../utils/helper'
import request from '../utils/request'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const isCollapsed = ref(false)
const pendingCount = ref(0)

const userInfo = computed(() => userStore.userInfo)
const role = computed(() => userStore.userInfo?.role || '')

async function fetchPendingCount() {
  try {
    const data = await request.get('/dashboard/stats')
    pendingCount.value = data.pendingReview || 0
  } catch {}
}

onMounted(() => {
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    fetchPendingCount()
  }
})

async function handleLogout() {
  await ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' })
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.main-layout { height: 100vh; }
.sidebar {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  transition: width 0.3s;
  overflow: hidden;
}
.logo-area {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
}
.logo-img {
  max-width: 180px;
  max-height: 50px;
  object-fit: contain;
}
.logo-img-collapsed {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
}
.header {
  background: linear-gradient(90deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
.username { font-size: 14px; color: #334155; font-weight: 500; }
.main-content { background: #f8fafc; min-height: calc(100vh - 64px); }
.review-badge { margin-left: 4px; }
</style>
