<template>
  <div class="dashboard">
    <!-- 欢迎头部区域 -->
    <div class="welcome-header">
      <div class="welcome-content">
        <div class="welcome-greeting">
          <div class="greeting-text">
            <h1>欢迎回来，{{ userInfo?.real_name || userInfo?.realName }}！</h1>
            <p class="date-info">{{ todayStr }}</p>
          </div>
        </div>

        <!-- 主要操作按钮 -->
        <div class="primary-actions">
          <el-button 
            type="primary" 
            size="large" 
            :icon="Plus" 
            @click="router.push('/plan/create')"
            class="create-btn"
          >
            新建计划
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片区域 -->
    <div class="stats-section">
      <h2 class="section-title">概览</h2>
      <el-row :gutter="20" class="stats-row">
        <el-col :xs="12" :sm="12" :md="6" v-for="card in statCards" :key="card.key">
          <div 
            class="stat-card" 
            :class="{ clickable: card.route }"
            @click="card.route && router.push(card.route)"
          >
            <div class="stat-card-content">
              <div class="stat-icon" :style="{ background: card.color + '15', color: card.color }">
                <el-icon :size="24"><component :is="card.icon" /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-num">{{ stats[card.key] || 0 }}</div>
                <div class="stat-label">{{ card.label }}</div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 快速操作区域 -->
    <div class="quick-actions-section">
      <h2 class="section-title">快速操作</h2>
      <el-row :gutter="16">
        <el-col :xs="12" :sm="8" :md="6" v-for="action in quickActions" :key="action.label">
          <div class="action-card" @click="router.push(action.to)">
            <div class="action-icon" :style="{ background: action.color + '15', color: action.color }">
              <el-icon :size="20"><component :is="action.icon" /></el-icon>
            </div>
            <div class="action-label">{{ action.label }}</div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import dayjs from 'dayjs'
import { 
  Plus, Document, DocumentChecked, EditPen, ChatDotRound, User, 
  Clock, Setting, View, List 
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const role = computed(() => userStore.userInfo?.role || '')
const stats = ref({})

const todayStr = dayjs().format('YYYY年MM月DD日 dddd')

const statCards = computed(() => {
  const cards = [
    { key: 'myPlansTotal', label: '我的计划', color: '#0891B2', icon: Document, route: '/plan/list' },
    { key: 'publishedTotal', label: '已发布计划', color: '#22C55E', icon: DocumentChecked, route: '/plan/published' },
    { key: 'pendingFeedback', label: '待反馈条目', color: '#F59E0B', icon: ChatDotRound, route: '/feedback/list' }
  ]
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    cards.splice(1, 0, { key: 'pendingReview', label: '待我审核', color: '#EF4444', icon: EditPen, route: '/review/pending' })
  }
  return cards
})

const quickActions = computed(() => {
  const all = [
    { label: '查看列表', to: '/plan/list', icon: List, color: '#0891B2' },
    { label: '已发布', to: '/plan/published', icon: View, color: '#22C55E' },
    { label: '填写反馈', to: '/feedback/list', icon: ChatDotRound, color: '#F59E0B' }
  ]
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    all.push({ label: '待审核', to: '/review/pending', icon: Clock, color: '#EF4444' })
  }
  if (role.value === 'ADMIN') {
    all.push({ label: '用户管理', to: '/system/users', icon: User, color: '#8B5CF6' })
  }
  return all
})

onMounted(async () => {
  try {
    stats.value = await request.get('/dashboard/stats')
  } catch {}
})
</script>

<style scoped>
.dashboard {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 欢迎头部区域 */
.welcome-header {
  margin-bottom: 40px;
}

.welcome-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%);
  padding: 32px 40px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(8, 145, 178, 0.08);
}

.welcome-greeting h1 {
  font-size: 28px;
  font-weight: 700;
  color: #164E63;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.welcome-greeting p {
  font-size: 15px;
  color: #0E7490;
  margin: 0;
  font-weight: 400;
}

/* 主要操作按钮 */
.create-btn {
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
  transition: all 0.2s ease;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.4);
}

/* 统计卡片区域 */
.stats-section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #164E63;
  margin-bottom: 20px;
  letter-spacing: -0.3px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  border: 1px solid #E0F2FE;
}

.stat-card.clickable {
  cursor: pointer;
}

.stat-card.clickable:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(8, 145, 178, 0.12);
  border-color: #BAE6FD;
}

.stat-card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-num {
  font-size: 32px;
  font-weight: 700;
  color: #164E63;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #64748B;
  font-weight: 500;
}

/* 快速操作区域 */
.quick-actions-section {
  margin-bottom: 40px;
}

.action-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #E0F2FE;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px auto;
  flex-shrink: 0;
}

.action-label {
  font-size: 14px;
  color: #164E63;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dashboard {
    padding: 16px;
  }

  .welcome-content {
    padding: 24px;
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }

  .welcome-greeting h1 {
    font-size: 22px;
  }

  .welcome-greeting p {
    font-size: 14px;
  }

  .create-btn {
    width: 100%;
    height: 44px;
  }

  .stat-card-content {
    flex-direction: column;
    text-align: center;
  }

  .stat-num {
    font-size: 28px;
  }
}
</style>
