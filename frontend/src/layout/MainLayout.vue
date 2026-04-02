<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar" :class="{ 'sidebar-collapsed': isCollapsed }">
      <div class="logo-area" :class="{ 'logo-area-collapsed': isCollapsed }">
        <img v-if="!isCollapsed" src="https://p.ipic.vip/lmzked.jpg" alt="Logo" class="logo-img" />
        <img v-else src="https://p.ipic.vip/lmzked.jpg" alt="Logo" class="logo-img-collapsed" />
        <div class="logo-glow"></div>
      </div>
      <el-menu
        :default-active="route.path"
        router
        :collapse="isCollapsed"
        background-color="#1e293b"
        text-color="#cbd5e1"
        active-text-color="#60a5fa"
        :collapse-transition="true"
        class="menu-wrapper"
      >
        <el-menu-item index="/dashboard" class="menu-item">
          <el-icon class="menu-icon"><House /></el-icon>
          <template #title>
            <span class="menu-title">工作台</span>
          </template>
        </el-menu-item>

        <el-sub-menu index="/plan" class="menu-sub">
          <template #title>
            <el-icon class="menu-icon"><Document /></el-icon>
            <span class="menu-title">计划管理</span>
          </template>
          <el-menu-item index="/plan/list" class="menu-item">
            <template #title>
              <span class="menu-title">我的计划</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/plan/published" class="menu-item">
            <template #title>
              <span class="menu-title">已发布计划</span>
            </template>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu
          index="/review"
          v-if="['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role)"
          class="menu-sub"
        >
          <template #title>
            <div class="menu-title-with-badge">
              <el-icon class="menu-icon"><EditPen /></el-icon>
              <span class="menu-title">审核中心</span>
              <el-badge v-if="pendingCount > 0" :value="pendingCount" class="review-badge" />
            </div>
          </template>
          <el-menu-item index="/review/pending" class="menu-item">
            <template #title>
              <span class="menu-title">列表审核</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/review/consolidated" class="menu-item">
            <template #title>
              <span class="menu-title">整合审核</span>
            </template>
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/feedback/list" class="menu-item">
          <el-icon class="menu-icon"><ChatDotRound /></el-icon>
          <template #title>
            <span class="menu-title">反馈管理</span>
          </template>
        </el-menu-item>

        <el-sub-menu index="/system" v-if="role === 'ADMIN'" class="menu-sub">
          <template #title>
            <el-icon class="menu-icon"><Setting /></el-icon>
            <span class="menu-title">系统管理</span>
          </template>
          <el-menu-item index="/system/users" class="menu-item">
            <template #title>
              <span class="menu-title">用户管理</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/system/departments" class="menu-item">
            <template #title>
              <span class="menu-title">部门管理</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/system/config" class="menu-item">
            <template #title>
              <span class="menu-title">系统配置</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/system/knowledge" class="menu-item">
            <template #title>
              <span class="menu-title">知识库管理</span>
            </template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container class="main-container" :class="{ 'main-container-collapsed': isCollapsed }">
      <!-- 顶部栏 -->
      <el-header class="header" :class="{ 'header-scrolled': isScrolled }">
        <div class="header-left">
          <el-button text @click="isCollapsed = !isCollapsed" class="collapse-btn">
            <el-icon :size="20" :class="{ 'rotate-180': !isCollapsed }">
              <component :is="isCollapsed ? Expand : Fold" />
            </el-icon>
          </el-button>
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">
              <span class="breadcrumb-item">首页</span>
            </el-breadcrumb-item>
            <el-breadcrumb-item>
              <span class="breadcrumb-item">{{ route.meta?.title || '' }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-button text class="header-btn" @click="showNotification">
            <el-icon :size="20" class="notification-icon">
              <BellFilled />
              <el-badge v-if="notificationCount > 0" :value="notificationCount" class="notification-badge" />
            </el-icon>
          </el-button>
          <el-button text class="header-btn" @click="toggleTheme">
            <el-icon :size="20"><component :is="isDarkMode ? Sunny : Moon" /></el-icon>
          </el-button>
          <el-dropdown trigger="click" class="user-dropdown" effect="fade">
            <div class="user-info">
              <el-avatar :size="32" class="user-avatar">
                {{ getUserInitials() }}
              </el-avatar>
              <div class="user-details" :class="{ 'user-details-collapsed': isMobile }">
                <span class="username">{{ userInfo?.real_name || userInfo?.realName || '管理员' }}</span>
              </div>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="user-dropdown-menu">
                <el-dropdown-item @click="handleProfile" class="dropdown-item">
                  <el-icon><User /></el-icon>
                  <span>个人信息</span>
                </el-dropdown-item>
                <el-dropdown-item @click="handleSettings" class="dropdown-item">
                  <el-icon><Setting /></el-icon>
                  <span>设置</span>
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout" class="dropdown-item">
                  <el-icon><SwitchButton /></el-icon>
                  <span>退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main-content">
        <transition name="fade-slide" mode="out-in">
          <router-view />
        </transition>
      </el-main>
    </el-container>
    
    <!-- AI 对话组件 -->
    <AIChat />
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox, ElNotification } from 'element-plus'
import { House, Document, EditPen, ChatDotRound, Setting, Fold, Expand, SwitchButton, User, ArrowDown, BellFilled, Moon, Sunny } from '@element-plus/icons-vue'
import { ROLES } from '../utils/helper'
import request from '../utils/request'
import AIChat from '../components/AIChat.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const isCollapsed = ref(false)
const isScrolled = ref(false)
const pendingCount = ref(0)
const notificationCount = ref(0)
const isDarkMode = ref(false)
const isMobile = ref(window.innerWidth < 768)

const userInfo = computed(() => userStore.userInfo)
const role = computed(() => userStore.userInfo?.role || '')

async function fetchPendingCount() {
  try {
    const data = await request.get('/dashboard/stats')
    pendingCount.value = data.pendingReview || 0
    notificationCount.value = data.notifications || 0
  } catch {}
}

function handleScroll() {
  isScrolled.value = window.scrollY > 10
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
}

function handleProfile() {
  // 个人信息页面逻辑
  console.log('个人信息')
}

function handleSettings() {
  // 设置页面逻辑
  console.log('设置')
}

async function handleLogout() {
  await ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' })
  userStore.logout()
  router.push('/login')
}

function showNotification() {
  ElNotification({
    title: '通知中心',
    message: '您有新的消息通知',
    type: 'info',
    duration: 3000
  })
  notificationCount.value = 0
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-mode')
  } else {
    document.documentElement.classList.remove('dark-mode')
  }
}

function getUserInitials() {
  const name = userInfo.value?.real_name || userInfo.value?.realName || '用户'
  return name.charAt(0).toUpperCase()
}

onMounted(() => {
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    fetchPendingCount()
  }
  window.addEventListener('scroll', handleScroll)
  window.addEventListener('resize', handleResize)
  
  // 检查系统深色模式偏好
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    toggleTheme()
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)
})

// 监听路由变化，更新面包屑
watch(() => route.path, () => {
  // 可以在这里添加路由变化的额外逻辑
})
</script>

<style scoped>
/* 基础样式 */
:root {
  --primary-color: #3b82f6;
  --primary-hover: #60a5fa;
  --bg-light: #ffffff;
  --bg-dark: #1e293b;
  --text-light: #f8fafc;
  --text-dark: #334155;
  --border-light: #e2e8f0;
  --border-dark: rgba(255, 255, 255, 0.1);
  --transition-base: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --gradient-primary: linear-gradient(135deg, #3b82f6, #60a5fa);
  --gradient-success: linear-gradient(135deg, #22c55e, #34d399);
  --gradient-warning: linear-gradient(135deg, #f59e0b, #fcd34d);
  --gradient-danger: linear-gradient(135deg, #ef4444, #f87171);
}

.main-layout { 
  height: 100vh;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  position: relative;
  backdrop-filter: blur(10px);
}



.logo-area {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.logo-area::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: all 0.3s var(--transition-base);
}

.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.2) 0%, transparent 70%);
  animation: logoGlow 3s ease-in-out infinite alternate;
}

@keyframes logoGlow {
  0% {
    width: 0;
    height: 0;
    opacity: 0.5;
  }
  100% {
    width: 120px;
    height: 120px;
    opacity: 0;
  }
}

.logo-img {
  max-width: 180px;
  max-height: 50px;
  object-fit: contain;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 2px 4px rgba(96, 165, 250, 0.3));
  position: relative;
  z-index: 1;
}

.logo-img:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 4px 8px rgba(96, 165, 250, 0.5));
}

.logo-img-collapsed {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
  transition: all 0.3s cubic-bezier(0.4, 0, 0, 1);
  filter: drop-shadow(0 2px 4px rgba(96, 165, 250, 0.3));
  position: relative;
  z-index: 1;
}

.logo-img-collapsed:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 4px 8px rgba(96, 165, 250, 0.5));
}

/* 菜单样式 */
.menu-wrapper {
  margin-top: 16px;
  padding: 0 8px;
}

.menu-item {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px !important;
  margin: 4px 0;
  overflow: hidden;
  position: relative;
}

.menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background: #60a5fa;
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s var(--transition-base);
}

.menu-item:hover::before {
  transform: scaleY(1);
}

.menu-item:hover {
  background-color: rgba(96, 165, 250, 0.1) !important;
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15);
}

.menu-item.is-active {
  background-color: rgba(96, 165, 250, 0.2) !important;
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.25);
}

.menu-item.is-active::before {
  transform: scaleY(1);
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
}

.menu-icon {
  transition: all 0.3s var(--transition-base);
  font-size: 18px;
  position: relative;
  z-index: 1;
}

.menu-item:hover .menu-icon {
  transform: scale(1.1);
  color: #60a5fa;
  filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.5));
}

.menu-title {
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 1;
}

.menu-item:hover .menu-title {
  color: #60a5fa;
  transform: translateX(2px);
}

.menu-sub {
  border-radius: 8px !important;
  margin: 4px 0;
  overflow: hidden;
  transition: all 0.3s var(--transition-base);
}

.menu-sub:hover {
  background-color: rgba(96, 165, 250, 0.05) !important;
}

.menu-title-with-badge {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  gap: 8px;
  z-index: 1;
}

.review-badge {
  margin-left: auto;
  animation: pulse 2s infinite;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  position: relative;
  z-index: 1;
}

/* 主容器样式 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 顶部栏样式 */
.header {
  background: linear-gradient(90deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(10px);
}

.header-scrolled {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  height: 56px;
  border-bottom: 1px solid rgba(96, 165, 250, 0.1);
}

.header-left, .header-right { 
  display: flex; 
  align-items: center; 
  gap: 16px;
  transition: all 0.3s var(--transition-base);
}

.collapse-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 8px;
  margin-right: 8px;
  position: relative;
  overflow: hidden;
}

.collapse-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.collapse-btn:hover::before {
  width: 100px;
  height: 100px;
}

.collapse-btn:hover {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.rotate-180 {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(180deg);
}

/* 顶部按钮样式 */
.header-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 8px;
  position: relative;
  overflow: hidden;
}

.header-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.header-btn:hover::before {
  width: 80px;
  height: 80px;
}

.header-btn:hover {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.notification-icon {
  position: relative;
  z-index: 1;
}

.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  animation: pulse 2s infinite;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  z-index: 1;
}

/* 面包屑样式 */
.breadcrumb {
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 1;
}

.breadcrumb-item {
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s var(--transition-base);
  position: relative;
  z-index: 1;
}

.breadcrumb-item:hover {
  color: #3b82f6;
  transform: translateY(-1px);
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

/* 用户信息样式 */
.user-dropdown {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.1);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.user-info::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
  z-index: -1;
}

.user-info:hover::before {
  width: 150px;
  height: 150px;
}

.user-info:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
}

.user-avatar {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  font-weight: 600;
  color: white;
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 1;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.user-info:hover .user-avatar {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
  animation: avatarPulse 2s ease-in-out infinite alternate;
}

@keyframes avatarPulse {
  0% {
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 6px 24px rgba(59, 130, 246, 0.8);
  }
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 1;
}

.user-details-collapsed {
  display: none;
}

.role-tag {
  transition: all 0.3s var(--transition-base);
  font-weight: 600;
  border-radius: 12px;
  padding: 2px 8px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border: none;
  font-size: 12px;
  position: relative;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.user-info:hover .role-tag {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.5);
}

.username {
  font-size: 14px;
  color: #334155;
  font-weight: 500;
  transition: all 0.3s var(--transition-base);
  min-width: 80px;
  position: relative;
  z-index: 1;
}

.user-info:hover .username {
  color: #3b82f6;
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.user-arrow {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  position: relative;
  z-index: 1;
}

.user-info:hover .user-arrow {
  transform: rotate(180deg) scale(1.1);
  color: #3b82f6;
}

/* 用户下拉菜单 */
.user-dropdown-menu {
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.1);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  transition: all 0.3s var(--transition-base);
}

.user-dropdown-menu:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  border-color: rgba(59, 130, 246, 0.2);
}

.dropdown-item {
  transition: all 0.2s var(--transition-base);
  border-radius: 0;
  position: relative;
  overflow: hidden;
}

.dropdown-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background: #3b82f6;
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s var(--transition-base);
}

.dropdown-item:hover::before {
  transform: scaleY(1);
}

.dropdown-item:hover {
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

/* 内容区样式 */
.main-content {
  background: #f8fafc;
  flex: 1;
  overflow-y: auto;
  transition: all 0.3s var(--transition-base);
  padding: 32px;
  background-image: radial-gradient(circle at 10% 20%, rgba(96, 165, 250, 0.05) 0%, transparent 20%),
                    radial-gradient(circle at 90% 80%, rgba(8, 145, 178, 0.05) 0%, transparent 20%);
}

/* 页面过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
  filter: blur(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(1.02);
  filter: blur(10px);
}

/* 呼吸动画 */
@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .sidebar:not(.el-aside--collapsed) {
    transform: translateX(0);
  }
  
  .header {
    padding: 0 16px;
    height: 56px;
  }
  
  .header-left {
    gap: 12px;
  }
  
  .header-right {
    gap: 8px;
  }
  
  .main-content {
    padding: 16px;
  }
  
  .user-info {
    padding: 6px 10px;
  }
  
  .user-details {
    display: none;
  }
  
  .role-tag {
    font-size: 12px;
  }
  
  .breadcrumb {
    display: none;
  }
  
  .user-avatar {
    width: 32px !important;
    height: 32px !important;
    font-size: 14px;
  }
  
  .header-btn {
    padding: 6px;
  }
  
  .header-btn .el-icon {
    font-size: 18px;
  }
  
  .collapse-btn {
    padding: 6px;
  }
  
  .collapse-btn .el-icon {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 0 12px;
  }
  
  .header-left {
    gap: 8px;
  }
  
  .header-right {
    gap: 6px;
  }
  
  .main-content {
    padding: 12px;
  }
  
  .user-info {
    padding: 4px 8px;
  }
  
  .user-avatar {
    width: 28px !important;
    height: 28px !important;
    font-size: 12px;
  }
  
  .header-btn {
    padding: 4px;
  }
  
  .header-btn .el-icon {
    font-size: 16px;
  }
  
  .collapse-btn {
    padding: 4px;
  }
  
  .collapse-btn .el-icon {
    font-size: 16px;
  }
  
  .role-tag {
    font-size: 10px;
    padding: 2px 6px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .header {
    padding: 0 20px;
  }
  
  .header-left {
    gap: 12px;
  }
  
  .header-right {
    gap: 12px;
  }
  
  .main-content {
    padding: 24px;
  }
}

/* 滚动条样式 */
.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  transition: background 0.3s var(--transition-base);
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
  box-shadow: 0 0 10px rgba(148, 163, 184, 0.5);
}

/* 深色模式支持 */
:global(.dark-mode) .header {
  background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:global(.dark-mode) .header-scrolled {
  background: rgba(15, 23, 42, 0.95) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
}

:global(.dark-mode) .breadcrumb-item {
  color: #cbd5e1;
}

:global(.dark-mode) .breadcrumb-item:hover {
  color: #60a5fa;
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
}

:global(.dark-mode) .user-info {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
}

:global(.dark-mode) .user-info:hover {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);
}

:global(.dark-mode) .username {
  color: #f8fafc;
}

:global(.dark-mode) .main-content {
  background: #0f172a;
  color: #f8fafc;
  background-image: radial-gradient(circle at 10% 20%, rgba(96, 165, 250, 0.1) 0%, transparent 20%),
                    radial-gradient(circle at 90% 80%, rgba(8, 145, 178, 0.1) 0%, transparent 20%);
}

:global(.dark-mode) .main-content::-webkit-scrollbar-track {
  background: #1e293b;
}

:global(.dark-mode) .main-content::-webkit-scrollbar-thumb {
  background: #475569;
}

:global(.dark-mode) .main-content::-webkit-scrollbar-thumb:hover {
  background: #64748b;
  box-shadow: 0 0 10px rgba(100, 116, 139, 0.5);
}

:global(.dark-mode) .user-dropdown-menu {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(96, 165, 250, 0.2);
}

:global(.dark-mode) .dropdown-item:hover {
  background-color: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
}
</style>
