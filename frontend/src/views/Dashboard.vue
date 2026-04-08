<template>
  <div class="dashboard">
    <!-- 欢迎头部区域 -->
    <div class="welcome-header">
      <div class="welcome-content" :class="{ 'welcome-content-scrolled': isScrolled }">
        <div class="welcome-greeting">
          <div class="greeting-text">
            <h1 class="greeting-title">欢迎回来，{{ userInfo?.real_name || userInfo?.realName }}！</h1>
            <p class="date-info">{{ todayStr }}</p>
            <p class="weather-info" v-if="weatherData">
              <el-icon class="weather-icon"><Calendar /></el-icon>
              {{ weatherData.temperature }}°C | {{ weatherData.description }}
            </p>
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
          <el-button 
            size="large" 
            :icon="Calendar" 
            @click="router.push('/plan/published')"
            class="secondary-btn"
          >
            查看日历
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片区域 -->
    <div class="stats-section">
      <div class="section-header">
        <h2 class="section-title">概览</h2>
        <el-select v-model="statsPeriod" size="small" class="stats-period-select" popper-class="custom-dropdown">
          <el-option label="本周" value="week" />
          <el-option label="本月" value="month" />
          <el-option label="本季度" value="quarter" />
        </el-select>
      </div>
      <el-row :gutter="20" class="stats-row">
        <el-col :xs="12" :sm="12" :md="6" v-for="card in statCards" :key="card.key">
          <div 
            class="stat-card" 
            :class="{ clickable: card.route }"
            @click="card.route && router.push(card.route)"
            :style="{ borderTopColor: card.color }"
          >
            <div class="stat-card-content">
              <div class="stat-icon" :style="{ background: card.color + '15', color: card.color }">
                <el-icon :size="24"><component :is="card.icon" /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-num">{{ stats[card.key] || 0 }}</div>
                <div class="stat-label">{{ card.label }}</div>
              </div>
              <div class="stat-trend" v-if="card.trend">
                <el-icon :size="16" :style="{ color: card.trend > 0 ? '#22C55E' : '#EF4444' }"><component :is="card.trend > 0 ? ArrowUp : ArrowDown" /></el-icon>
                <span :style="{ color: card.trend > 0 ? '#22C55E' : '#EF4444' }">{{ Math.abs(card.trend) }}%</span>
              </div>
            </div>
            <div class="stat-progress" v-if="card.progress">
              <el-progress 
                :percentage="card.progress" 
                :color="card.color" 
                :stroke-width="4" 
                :show-text="false"
              />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 预发工作指导区域 -->
    <div class="guideline-section" v-if="!loadingGuideline && (upcomingGuideline?.content || ['OFFICE_HEAD', 'ADMIN'].includes(role))">
      <div class="section-header">
        <h2 class="section-title">
          <el-icon class="title-icon"><Calendar /></el-icon>
          下周工作指导 (第{{ (stats?.currentWeekNum || 0) + 1 }}周)
        </h2>
        <el-tag size="small" :type="upcomingGuideline?.content ? 'success' : 'info'" effect="light" round class="guideline-tag">
          {{ upcomingGuideline?.content ? '已预发' : '未预发' }}
        </el-tag>
      </div>
      <div class="guideline-card" :class="{ 'is-empty': !upcomingGuideline?.content }">
        <div v-if="upcomingGuideline?.content" class="guideline-content" v-html="formatGuidelineContent(upcomingGuideline?.content)"></div>
        <el-empty v-else description="暂无下周预发工作指导" :image-size="60" />
      </div>
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
            <div class="action-badge" v-if="action.badge">{{ action.badge }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 标签页区域 -->
    <div class="tabs-section">
      <div class="tabs-container">
        <div class="tabs-header">
          <div 
            v-for="tab in tabs" 
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
            <span class="tab-label">{{ tab.label }}</span>
          </div>
        </div>
        
        <div class="tabs-content">
          <!-- 数据趋势 -->
          <div v-show="activeTab === 'chart'" class="tab-panel">
            <div class="section-header">
              <h2 class="section-title">数据趋势</h2>
              <el-select v-model="chartTimeRange" size="small" class="chart-time-select">
                <el-option label="近7天" value="7d" />
                <el-option label="近30天" value="30d" />
                <el-option label="本季度" value="quarter" />
                <el-option label="本年度" value="year" />
              </el-select>
            </div>
            <el-row :gutter="20">
              <el-col :xs="24" :md="12">
                <div class="chart-card">
                  <div class="chart-header">
                    <h3 class="chart-title">计划状态分布</h3>
                    <el-button size="small" @click="refreshCharts" class="chart-action-btn">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                  <div id="planStatusChart" class="chart-container"></div>
                </div>
              </el-col>
              <el-col :xs="24" :md="12">
                <div class="chart-card">
                  <div class="chart-header">
                    <h3 class="chart-title">部门计划数量</h3>
                    <el-button size="small" @click="refreshCharts" class="chart-action-btn">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                  <div id="departmentPlanChart" class="chart-container"></div>
                </div>
              </el-col>
              <el-col :xs="24" :md="12">
                <div class="chart-card">
                  <div class="chart-header">
                    <h3 class="chart-title">计划完成趋势</h3>
                    <el-button size="small" @click="refreshCharts" class="chart-action-btn">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                  <div id="planTrendChart" class="chart-container"></div>
                </div>
              </el-col>
              <el-col :xs="24" :md="12">
                <div class="chart-card">
                  <div class="chart-header">
                    <h3 class="chart-title">部门工作效率</h3>
                    <el-button size="small" @click="refreshCharts" class="chart-action-btn">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>
                  <div id="departmentEfficiencyChart" class="chart-container"></div>
                </div>
              </el-col>
            </el-row>
          </div>

          <!-- AI 智能分析 -->
          <div v-show="activeTab === 'ai'" class="tab-panel">
            <div class="ai-card">
              <div class="ai-header">
                <el-icon :size="24" class="ai-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>
                </el-icon>
                <h3 class="ai-title">本周工作洞察</h3>
                <el-tag size="small" type="info" class="ai-tag">实时分析</el-tag>
              </div>
              <div class="ai-content">
                <div v-if="loading" class="ai-loading">
                  <el-skeleton :rows="6" animated />
                </div>
                <div v-else>
                  <!-- 阶段工作的总结 -->
                  <div class="ai-summary-section">
                    <h4 class="ai-section-title">
                      <el-icon><Document /></el-icon> 阶段工作的总结
                    </h4>
                    <div class="ai-summary">{{ aiAnalysis?.stageSummary || '本阶段工作进展良好，计划完成率达到85%，各项工作有序推进。' }}</div>
                  </div>

                  <!-- 工作洞察 -->
                  <div class="ai-insights-section">
                    <h4 class="ai-section-title">
                      <el-icon><Document /></el-icon> 工作洞察
                    </h4>
                    <div class="ai-insights">
                      <div class="insight-item" v-for="(insight, index) in aiInsights" :key="index">
                        <div class="insight-icon">
                          <el-icon><component :is="getInsightIcon(insight.icon)" /></el-icon>
                        </div>
                        <div class="insight-content-wrapper">
                          <div class="insight-text">{{ insight.text }}</div>
                          <div class="insight-desc" v-if="insight.desc">{{ insight.desc }}</div>
                        </div>
                        <el-tag v-if="insight.priority" :type="insight.priority === 'high' ? 'danger' : 'warning'" size="small" class="insight-priority">
                          {{ insight.priority === 'high' ? '重要' : '提醒' }}
                        </el-tag>
                      </div>
                    </div>
                  </div>

                  <!-- 新的一周的计划安排提示 -->
                  <div class="ai-weekly-tips-section">
                    <h4 class="ai-section-title">
                      <el-icon><Calendar /></el-icon> 新周计划提示
                    </h4>
                    <div class="ai-weekly-tips">{{ aiAnalysis?.weeklyPlanTips || '下周建议：1. 完成未完成的计划项；2. 准备下周的重要会议材料；3. 跟进九年级的计划提交情况；4. 总结本阶段工作经验。' }}</div>
                  </div>

                  <!-- 下一阶段的工作安排 -->
                  <div class="ai-next-stage-section">
                    <h4 class="ai-section-title">
                      <el-icon><Document /></el-icon> 下一阶段工作安排
                    </h4>
                    <div class="ai-next-stage">{{ aiAnalysis?.nextStagePlan || '下一阶段工作建议：1. 继续保持良好的工作状态；2. 加强部门间的沟通协作；3. 关注学校整体发展目标；4. 优化工作计划和流程，提高工作效率。' }}</div>
                  </div>

                  <!-- 关键指标 -->
                  <div class="ai-metrics-section">
                    <h4 class="ai-section-title">
                      <el-icon><DataAnalysis /></el-icon> 关键指标
                    </h4>
                    <div class="ai-metrics">
                      <div class="metric-item" v-for="(value, key) in aiAnalysis?.metrics" :key="key">
                        <div class="metric-label">{{ getMetricLabel(key) }}</div>
                        <div class="metric-value">{{ value }}{{ getMetricUnit(key) }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- 趋势分析 -->
                  <div class="ai-trend-section" v-if="aiAnalysis?.trendAnalysis">
                    <h4 class="ai-section-title">
                      <el-icon><DataLine /></el-icon> 趋势分析
                    </h4>
                    <div class="ai-trend">
                      <div class="trend-summary">
                        <el-tag :type="getTrendTagType(aiAnalysis.trendAnalysis.trend)" size="large" class="trend-tag">
                          {{ getTrendLabel(aiAnalysis.trendAnalysis.trend) }}
                        </el-tag>
                        <span class="trend-description">平均完成率: {{ aiAnalysis.trendAnalysis.averageRate }}%</span>
                      </div>
                      
                      <!-- 历史完成率图表 -->
                      <div class="trend-chart-container" v-if="aiAnalysis?.historicalData && aiAnalysis.historicalData.length > 0">
                        <div id="trendChart" class="trend-chart"></div>
                      </div>
                    </div>
                  </div>

                  <!-- 历史数据 -->
                  <div class="ai-history-section" v-if="aiAnalysis?.historicalData && aiAnalysis.historicalData.length > 0">
                    <h4 class="ai-section-title">
                      <el-icon><Clock /></el-icon> 历史数据
                    </h4>
                    <div class="ai-history">
                      <div class="history-item" v-for="(item, index) in aiAnalysis.historicalData" :key="index">
                        <div class="history-week">{{ item.week }}</div>
                        <div class="history-completion">
                          <el-progress 
                            :percentage="item.completionRate" 
                            :color="getProgressColor(item.completionRate)"
                            :stroke-width="8"
                          />
                        </div>
                        <div class="history-counts">
                          <span class="completed">{{ item.completed }}/{{ item.total }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 角色特定建议 -->
                  <div class="ai-role-suggestions-section" v-if="aiAnalysis?.roleSpecificSuggestions && aiAnalysis.roleSpecificSuggestions.length > 0">
                    <h4 class="ai-section-title">
                      <el-icon><User /></el-icon> 角色建议
                    </h4>
                    <div class="ai-role-suggestions">
                      <div class="role-suggestion-item" v-for="(suggestion, index) in aiAnalysis.roleSpecificSuggestions" :key="index">
                        <el-icon class="suggestion-icon"><Check /></el-icon>
                        <div class="suggestion-text">{{ suggestion }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ai-footer">
                <el-button size="small" @click="refreshAIInsights" :loading="loading" class="refresh-btn">
                  <el-icon><Refresh /></el-icon> 刷新分析
                </el-button>
                <el-button size="small" @click="exportAnalysis" class="export-btn">
                  <el-icon><Download /></el-icon> 导出报告
                </el-button>
                <el-button size="small" @click="viewDetailedAnalysis" class="detail-btn">
                  <el-icon><View /></el-icon> 详细分析
                </el-button>
              </div>
            </div>
          </div>

          <!-- 最近活动 -->
          <div v-show="activeTab === 'activity'" class="tab-panel">
            <div class="activity-card">
              <div class="activity-item" v-for="(activity, index) in recentActivities" :key="index">
                <div class="activity-icon" :style="{ background: activity.color + '15', color: activity.color }">
                  <el-icon><component :is="activity.icon" /></el-icon>
                </div>
                <div class="activity-content">
                  <div class="activity-title">{{ activity.title }}</div>
                  <div class="activity-description">{{ activity.description }}</div>
                  <div class="activity-time">{{ activity.time }}</div>
                </div>
                <div class="activity-status" :class="activity.status">{{ activity.statusText }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { 
  Plus, Document, DocumentChecked, EditPen, ChatDotRound, 
  Clock, Setting, View, List, ArrowUp, ArrowDown, Refresh, 
  Calendar, Warning, Download, Check, Top, DataLine, User, InfoFilled, DataAnalysis
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const role = computed(() => userStore.userInfo?.role || '')
const stats = ref({})
const loading = ref(false)
const aiInsights = ref([])
const aiAnalysis = ref(null)
const statsPeriod = ref('week')
const chartTimeRange = ref('7d')
const isScrolled = ref(false)
const weatherData = ref(null)
const recentActivities = ref([])
const chartData = ref(null)
const semesterWeeks = ref(20) // 学期周次总数
const activeTab = ref('chart')
const upcomingGuideline = ref(null)
const loadingGuideline = ref(false)

let planStatusChart = null
let departmentPlanChart = null
let planTrendChart = null
let departmentEfficiencyChart = null
let trendChart = null

const tabs = [
  { id: 'chart', label: '数据趋势', icon: DataLine },
  { id: 'ai', label: 'AI智能分析', icon: DataAnalysis },
  { id: 'activity', label: '最近活动', icon: Clock }
]

const todayStr = dayjs().format('YYYY年MM月DD日 dddd')

const statCards = computed(() => {
  const cards = [
    { 
      key: 'myPlansTotal', 
      label: '我的计划', 
      color: '#0891B2', 
      icon: Document, 
      route: '/plan/list', 
      trend: stats.value?.myPlansTrend ?? 15, 
      progress: stats.value?.myPlansProgress ?? 75 
    },
    { 
      key: 'publishedTotal', 
      label: '已发布计划', 
      color: '#22C55E', 
      icon: DocumentChecked, 
      route: '/plan/published', 
      trend: stats.value?.publishedTrend ?? 8, 
      progress: stats.value?.publishedProgress ?? 90 
    },
    { 
      key: 'pendingFeedback', 
      label: '待反馈条目', 
      color: '#F59E0B', 
      icon: ChatDotRound, 
      route: '/feedback/list', 
      trend: stats.value?.pendingFeedbackTrend ?? -5, 
      progress: stats.value?.pendingFeedbackProgress ?? 45 
    }
  ]
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    cards.splice(1, 0, { 
      key: 'pendingReview', 
      label: '待我审核', 
      color: '#EF4444', 
      icon: EditPen, 
      route: '/review/pending', 
      trend: stats.value?.pendingReviewTrend ?? 20, 
      progress: stats.value?.pendingReviewProgress ?? 30 
    })
  }
  return cards
})

const quickActionsStats = ref({
  myPlans: 0,
  publishedPlans: 0,
  pendingFeedback: 0,
  pendingReview: 0
})

const quickActions = computed(() => {
  const all = [
    { label: '查看列表', to: '/plan/list', icon: List, color: '#0891B2', badge: quickActionsStats.value.myPlans > 0 ? String(quickActionsStats.value.myPlans) : null },
    { label: '已发布', to: '/plan/published', icon: View, color: '#22C55E', badge: quickActionsStats.value.publishedPlans > 0 ? String(quickActionsStats.value.publishedPlans) : null },
    { label: '填写反馈', to: '/feedback/list', icon: ChatDotRound, color: '#F59E0B', badge: quickActionsStats.value.pendingFeedback > 0 ? String(quickActionsStats.value.pendingFeedback) : null }
  ]
  if (['DEPT_HEAD','OFFICE_HEAD','PRINCIPAL','ADMIN'].includes(role.value)) {
    all.push({ label: '待审核', to: '/review/pending', icon: Clock, color: '#EF4444', badge: quickActionsStats.value.pendingReview > 0 ? String(quickActionsStats.value.pendingReview) : null })
  }
  if (role.value === 'ADMIN') {
    all.push({ label: '用户管理', to: '/system/users', icon: User, color: '#8B5CF6' })
  }
  return all
})

async function fetchQuickActionsStats() {
  try {
    const data = await request.get('/dashboard/quick-actions-stats')
    quickActionsStats.value = data
  } catch (error) {
    console.error('获取快捷操作统计失败:', error)
  }
}

function handleScroll() {
  isScrolled.value = window.scrollY > 50
}

async function fetchChartData() {
  try {
    const response = await request.get('/dashboard/chart-data')
    chartData.value = response
    return response
  } catch (error) {
    console.error('获取图表数据失败:', error)
    return null
  }
}

function initPlanStatusChart(data) {
  const chartDom = document.getElementById('planStatusChart')
  if (chartDom) {
    planStatusChart = echarts.init(chartDom)
    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: 'var(--color-bg-primary, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--color-border-light, #e2e8f0)',
        borderWidth: 1,
        textStyle: { color: 'var(--color-text-primary, #334155)' }
      },
      legend: {
        top: '5%',
        left: 'center',
        textStyle: { color: 'var(--color-text-secondary, #64748b)' }
      },
      series: [
        {
          name: '计划状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: 'var(--color-bg-primary, #fff)',
            borderWidth: 2,
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              color: 'var(--color-text-primary, #164E63)'
            },
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          },
          labelLine: {
            show: false
          },
          data: data?.planStatus || [
            { value: 0, name: '草稿', itemStyle: { color: '#94A3B8' } },
            { value: 0, name: '待审核', itemStyle: { color: '#F59E0B' } },
            { value: 0, name: '已发布', itemStyle: { color: '#0891B2' } },
            { value: 0, name: '已完成', itemStyle: { color: '#22C55E' } }
          ]
        }
      ]
    }
    planStatusChart.setOption(option)
  }
}

function initDepartmentPlanChart(data) {
  const chartDom = document.getElementById('departmentPlanChart')
  if (chartDom) {
    departmentPlanChart = echarts.init(chartDom)
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        backgroundColor: 'var(--color-bg-primary, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--color-border-light, #e2e8f0)',
        borderWidth: 1,
        textStyle: { color: 'var(--color-text-primary, #334155)' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data?.departmentPlans?.names || ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
        axisLabel: {
          interval: 0,
          rotate: 30,
          color: 'var(--color-text-secondary, #64748b)'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: 'var(--color-text-secondary, #64748b)'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        },
        splitLine: {
          lineStyle: { color: 'var(--color-border-subtle, #f1f5f9)' }
        }
      },
      series: [
        {
          name: '计划数量',
          type: 'bar',
          data: data?.departmentPlans?.counts || [0, 0, 0, 0, 0, 0, 0],
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#0891B2' },
              { offset: 1, color: '#06B6D4' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#06B6D4' },
                { offset: 1, color: '#0891B2' }
              ])
            }
          }
        }
      ]
    }
    departmentPlanChart.setOption(option)
  }
}

function initPlanTrendChart(data) {
  const chartDom = document.getElementById('planTrendChart')
  if (chartDom) {
    planTrendChart = echarts.init(chartDom)
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--color-bg-primary, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--color-border-light, #e2e8f0)',
        borderWidth: 1,
        textStyle: { color: 'var(--color-text-primary, #334155)' }
      },
      legend: {
        data: ['计划总数', '已完成', '进行中'],
        top: 0,
        textStyle: { color: 'var(--color-text-secondary, #64748b)' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data?.planTrend?.weeks || ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'],
        axisLabel: {
          color: 'var(--color-text-secondary, #64748b)'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: 'var(--color-text-secondary, #64748b)'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        },
        splitLine: {
          lineStyle: { color: 'var(--color-border-subtle, #f1f5f9)' }
        }
      },
      series: [
        {
          name: '计划总数',
          type: 'line',
          stack: 'Total',
          data: data?.planTrend?.total || [0, 0, 0, 0, 0, 0],
          lineStyle: { color: '#0891B2' },
          itemStyle: { color: '#0891B2' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(8, 145, 178, 0.3)' },
              { offset: 1, color: 'rgba(8, 145, 178, 0.1)' }
            ])
          }
        },
        {
          name: '已完成',
          type: 'line',
          stack: 'Total',
          data: data?.planTrend?.completed || [0, 0, 0, 0, 0, 0],
          lineStyle: { color: '#22C55E' },
          itemStyle: { color: '#22C55E' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0.1)' }
            ])
          }
        },
        {
          name: '进行中',
          type: 'line',
          stack: 'Total',
          data: data?.planTrend?.inProgress || [0, 0, 0, 0, 0, 0],
          lineStyle: { color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.1)' }
            ])
          }
        }
      ]
    }
    planTrendChart.setOption(option)
  }
}

function initDepartmentEfficiencyChart(data) {
  const chartDom = document.getElementById('departmentEfficiencyChart')
  if (chartDom) {
    departmentEfficiencyChart = echarts.init(chartDom)
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: 'var(--color-bg-primary, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--color-border-light, #e2e8f0)',
        borderWidth: 1,
        textStyle: { color: 'var(--color-text-primary, #334155)' }
      },
      legend: {
        data: ['完成率', '平均耗时(天)'],
        top: 0,
        textStyle: { color: 'var(--color-text-secondary, #64748b)' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: data?.departmentEfficiency?.names || ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
          axisLabel: {
            interval: 0,
            rotate: 30,
            color: 'var(--color-text-secondary, #64748b)'
          },
          axisLine: {
            lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
          }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: '完成率(%)',
          min: 0,
          max: 100,
          axisLabel: {
            color: 'var(--color-text-secondary, #64748b)',
            formatter: '{value}%'
          },
          axisLine: {
            lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
          },
          splitLine: {
            lineStyle: { color: 'var(--color-border-subtle, #f1f5f9)' }
          }
        },
        {
          type: 'value',
          name: '平均耗时(天)',
          min: 0,
          max: 10,
          axisLabel: {
            color: 'var(--color-text-secondary, #64748b)',
            formatter: '{value}天'
          },
          axisLine: {
            lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: '完成率',
          type: 'bar',
          data: data?.departmentEfficiency?.completionRates || [0, 0, 0, 0, 0, 0, 0],
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#60A5FA' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#60A5FA' },
                { offset: 1, color: '#3B82F6' }
              ])
            }
          }
        },
        {
          name: '平均耗时(天)',
          type: 'line',
          yAxisIndex: 1,
          data: data?.departmentEfficiency?.avgDays || [0, 0, 0, 0, 0, 0, 0],
          lineStyle: { color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    }
    departmentEfficiencyChart.setOption(option)
  }
}

async function refreshCharts() {
  const data = await fetchChartData()
  if (activeTab.value === 'chart') {
    initPlanStatusChart(data)
    initDepartmentPlanChart(data)
    initPlanTrendChart(data)
    initDepartmentEfficiencyChart(data)
  }
}

async function refreshAIInsights() {
  loading.value = true
  try {
    const data = await request.get('/dashboard/ai-analysis')
    aiInsights.value = data.insights || []
    aiAnalysis.value = data
    if (activeTab.value === 'ai') {
      setTimeout(() => initTrendChart(), 100)
    }
  } catch (error) {
    console.error('获取AI分析失败:', error)
    const mockData = {
      insights: [
        {
          icon: 'Document',
          text: '本周工作计划完成率为85%，高于上周的78%，继续保持！',
          priority: 'normal'
        },
        {
          icon: 'Calendar',
          text: '下周有3个重要会议需要安排，建议提前准备相关材料。',
          priority: 'warning'
        },
        {
          icon: 'Document',
          text: '教务处的计划完成质量较高，值得其他部门学习。',
          priority: 'normal'
        },
        {
          icon: 'Warning',
          text: '九年级有2个计划尚未提交，建议及时跟进。',
          priority: 'high'
        },
      ],
      stageSummary: '本阶段工作进展良好，计划完成率达到85%，各项工作有序推进。学期计划制定完善，行事历安排合理，整体工作符合预期。',
      weeklyPlanTips: '下周建议：1. 完成未完成的计划项；2. 准备下周的重要会议材料；3. 跟进九年级的计划提交情况；4. 总结本阶段工作经验。',
      nextStagePlan: '下一阶段工作建议：1. 继续保持良好的工作状态；2. 加强部门间的沟通协作；3. 关注学校整体发展目标；4. 优化工作计划和流程，提高工作效率。',
      metrics: {
        completionRate: 85,
        semesterPlans: 5,
        weekPlans: 24,
        calendarEvents: 12,
        nextWeekPlans: 3,
        averagePlansPerWeek: 6
      },
      trendAnalysis: {
        trend: 'improving',
        averageRate: 82
      },
      historicalData: [
        { week: '第1周', completionRate: 75, completed: 9, total: 12 },
        { week: '第2周', completionRate: 80, completed: 10, total: 13 },
        { week: '第3周', completionRate: 78, completed: 9, total: 12 },
        { week: '第4周', completionRate: 85, completed: 11, total: 13 },
        { week: '第5周', completionRate: 88, completed: 12, total: 14 },
        { week: '第6周', completionRate: 85, completed: 11, total: 13 }
      ],
      roleSpecificSuggestions: [
        '作为教务主任，建议重点关注教学质量提升计划的落实情况',
        '加强与各年级组的沟通，确保教学进度同步',
        '定期组织教学研讨活动，促进教师专业发展'
      ]
    }
    aiInsights.value = mockData.insights || []
    aiAnalysis.value = mockData
    if (activeTab.value === 'ai') {
      setTimeout(() => initTrendChart(), 100)
    }
  } finally {
    loading.value = false
  }
}

function getInsightIcon(iconName) {
  const icons = {
    'Document': Document,
    'Warning': Warning,
    'Calendar': Calendar,
    'InfoFilled': InfoFilled,
    'User': User,
    'Top': Top,
    'Check': Check
  }
  return icons[iconName] || Document
}

function getMetricLabel(key) {
  const labels = {
    completionRate: '完成率',
    semesterPlans: '学期计划数',
    weekPlans: '周计划数',
    calendarEvents: '行事历事件数',
    nextWeekPlans: '下周计划数',
    averagePlansPerWeek: '平均每周计划数'
  }
  return labels[key] || key
}

function getMetricUnit(key) {
  if (key === 'completionRate') return '%'
  return ''
}

function getTrendTagType(trend) {
  const types = {
    'improving': 'success',
    'declining': 'danger',
    'stable': 'info'
  }
  return types[trend] || 'info'
}

function getTrendLabel(trend) {
  const labels = {
    'improving': '上升趋势',
    'declining': '下降趋势',
    'stable': '稳定趋势'
  }
  return labels[trend] || '稳定趋势'
}

function getProgressColor(percentage) {
  if (percentage >= 80) return '#22C55E'
  if (percentage >= 60) return '#F59E0B'
  return '#EF4444'
}

function initTrendChart() {
  const chartDom = document.getElementById('trendChart')
  if (chartDom && aiAnalysis.value?.historicalData) {
    trendChart = echarts.init(chartDom)
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--color-bg-primary, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--color-border-light, #e2e8f0)',
        borderWidth: 1,
        textStyle: { color: 'var(--color-text-primary, #334155)' },
        formatter: (params) => {
          const data = params[0]
          return `${data.name}<br/>完成率: ${data.value}%`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: aiAnalysis.value.historicalData.map(d => d.week),
        axisLabel: {
          color: 'var(--color-text-secondary, #64748b)'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: 'var(--color-text-secondary, #64748b)',
          formatter: '{value}%'
        },
        axisLine: {
          lineStyle: { color: 'var(--color-border-light, #e2e8f0)' }
        },
        splitLine: {
          lineStyle: { color: 'var(--color-border-subtle, #f1f5f9)' }
        }
      },
      series: [
        {
          name: '完成率',
          type: 'line',
          stack: 'Total',
          data: aiAnalysis.value.historicalData.map(d => d.completionRate),
          smooth: true,
          lineStyle: { 
            color: '#3B82F6',
            width: 3
          },
          itemStyle: { 
            color: '#3B82F6',
            borderWidth: 2,
            borderColor: 'var(--color-bg-primary, #fff)'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
            ])
          },
          symbol: 'circle',
          symbolSize: 10,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(59, 130, 246, 0.5)'
            }
          }
        }
      ]
    }
    trendChart.setOption(option)
  }
}

function viewDetailedAnalysis() {
  console.log('查看详细分析')
}

function exportAnalysis() {
  console.log('导出分析报告')
}

function fetchWeatherData() {
  weatherData.value = {
    temperature: 22,
    description: '晴天'
  }
}

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })
    if (map.semester_weeks) {
      semesterWeeks.value = parseInt(map.semester_weeks) || 20
    }
  } catch (e) {
    console.warn('读取系统配置失败，使用默认值', e)
  }
}

function getActivityIcon(iconName) {
  const icons = {
    'Document': Document,
    'DocumentChecked': DocumentChecked,
    'EditPen': EditPen,
    'ChatDotRound': ChatDotRound
  }
  return icons[iconName] || Document
}

function formatGuidelineContent(content) {
  if (!content) return ''
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
  return escaped.replace(/\n/g, '<br>')
}

async function fetchRecentActivities() {
  try {
    const data = await request.get('/dashboard/recent-activities')
    recentActivities.value = data.map(activity => ({
      ...activity,
      icon: getActivityIcon(activity.icon),
      title: activity.title
    }))
  } catch (error) {
    console.error('获取最近活动失败:', error)
    recentActivities.value = []
  }
}

async function fetchUpcomingGuideline(semester, weekNumber) {
  loadingGuideline.value = true
  try {
    const data = await request.get(`/guidelines/current`, { params: { semester, weekNumber } })
    if (data) {
      upcomingGuideline.value = data
    }
  } catch (error) {
    console.error('获取预发工作指导失败:', error)
  } finally {
    loadingGuideline.value = false
  }
}

watch(statsPeriod, (newPeriod) => {
  console.log('统计周期变化:', newPeriod)
})

watch(activeTab, async (newTab) => {
  await nextTick()
  if (newTab === 'chart') {
    if (chartData.value) {
      initPlanStatusChart(chartData.value)
      initDepartmentPlanChart(chartData.value)
      initPlanTrendChart(chartData.value)
      initDepartmentEfficiencyChart(chartData.value)
    }
  } else if (newTab === 'ai') {
    if (aiAnalysis.value) {
      setTimeout(() => initTrendChart(), 100)
    }
  }
})

function handleResize() {
  planStatusChart?.resize()
  departmentPlanChart?.resize()
  planTrendChart?.resize()
  departmentEfficiencyChart?.resize()
  trendChart?.resize()
}

onMounted(async () => {
  try {
    stats.value = await request.get('/dashboard/stats')
    if (stats.value?.currentSemester && stats.value?.currentWeekNum !== undefined) {
      fetchUpcomingGuideline(stats.value.currentSemester, stats.value.currentWeekNum + 1)
    }
  } catch {}
  
  await fetchQuickActionsStats()
  
  const chartData = await fetchChartData()
  setTimeout(() => {
    initPlanStatusChart(chartData)
    initDepartmentPlanChart(chartData)
    initPlanTrendChart(chartData)
    initDepartmentEfficiencyChart(chartData)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll)
  }, 100)
  
  await refreshAIInsights()
  
  fetchWeatherData()
  
  await fetchRecentActivities()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)
  planStatusChart?.dispose()
  departmentPlanChart?.dispose()
  planTrendChart?.dispose()
  departmentEfficiencyChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.dashboard {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 欢迎头部区域 */
.welcome-header {
  margin-bottom: 40px;
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%);
  padding: 32px 40px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(8, 145, 178, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.welcome-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, #0891B2, #06B6D4, #3B82F6);
  animation: gradientShift 3s ease-in-out infinite alternate;
}

@keyframes gradientShift {
  0% {
    background: linear-gradient(90deg, #0891B2, #06B6D4, #3B82F6);
  }
  100% {
    background: linear-gradient(90deg, #3B82F6, #0891B2, #06B6D4);
  }
}

.welcome-content::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.05) 0%, transparent 70%);
  animation: welcomePulse 4s ease-in-out infinite;
}

@keyframes welcomePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.welcome-content-scrolled {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(8, 145, 178, 0.12);
}

.welcome-greeting {
  position: relative;
  z-index: 1;
}

.greeting-title {
  font-size: 28px;
  font-weight: 700;
  color: #164E63;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
  transition: all 0.3s var(--transition-base);
  position: relative;
  display: inline-block;
}

.greeting-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 3px;
  background: linear-gradient(90deg, #0891B2, #06B6D4);
  transition: width 0.4s ease;
  border-radius: 2px;
}

.welcome-content:hover .greeting-title::after {
  width: 100%;
}

.welcome-greeting p {
  font-size: 15px;
  color: #0E7490;
  margin: 0;
  font-weight: 400;
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 1;
}

.weather-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px !important;
  font-size: 14px !important;
  color: #0E7490;
  position: relative;
  z-index: 1;
}

.weather-icon {
  animation: weatherIconSpin 3s ease-in-out infinite;
}

@keyframes weatherIconSpin {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(10deg) scale(1.1);
  }
}

/* 主要操作按钮 */
.primary-actions {
  display: flex;
  gap: 16px;
  transition: all 0.3s var(--transition-base);
  position: relative;
  z-index: 10;
}

.create-btn {
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.4);
}

.create-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.create-btn:hover::before {
  left: 100%;
}

.secondary-btn {
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: #ffffff;
  border: 2px solid #0891B2;
  color: #0891B2;
  box-shadow: 0 2px 8px rgba(8, 145, 178, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.secondary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.2);
  background: rgba(8, 145, 178, 0.05);
}

/* 统计卡片区域 */
.stats-section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #164E63;
  margin: 0;
  letter-spacing: -0.3px;
  transition: all var(--transition-base);
}

.stats-period-select {
  width: 120px;
  transition: all 0.3s var(--transition-base);
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #E0F2FE;
  position: relative;
  overflow: hidden;
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
  transition: all var(--transition-base);
  margin-bottom: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-card:hover .stat-icon {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.2);
}

.stat-info {
  flex: 1;
  transition: all var(--transition-base);
}

.stat-num {
  font-size: 32px;
  font-weight: 700;
  color: #164E63;
  line-height: 1;
  margin-bottom: 4px;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.stat-label {
  font-size: 13px;
  color: #64748B;
  font-weight: 500;
  transition: all var(--transition-base);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  transition: all var(--transition-base);
  background: rgba(34, 197, 94, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
}

.stat-progress {
  margin-top: 16px;
  transition: all var(--transition-base);
}

/* 预发工作指导区域 */
.guideline-section {
  margin-bottom: 40px;
}

.guideline-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.guideline-section .section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guideline-section .title-icon {
  color: #0891B2;
}

.guideline-card {
  background: linear-gradient(to right, #F8FAFC, #FFFFFF);
  border-left: 4px solid #0891B2;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border-top: 1px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #E2E8F0;
}

.guideline-card.is-empty {
  padding: 0;
  background: #F8FAFC;
  border-left-color: #94A3B8;
}

.guideline-content {
  font-size: 15px;
  color: #334155;
  line-height: 1.6;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #E0F2FE;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #0891B2 0%, #06B6D4 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s var(--transition-base);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
}

.action-card:hover::before {
  transform: scaleX(1);
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.action-card:hover .action-icon {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.2);
}

.action-label {
  font-size: 14px;
  color: #164E63;
  font-weight: 500;
  transition: all var(--transition-base);
  margin-bottom: 8px;
}

.action-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #EF4444;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  animation: pulse 2s infinite;
}

/* 标签页区域 */
.tabs-section {
  margin-bottom: 40px;
}

.tabs-container {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  overflow: hidden;
}

.tabs-header {
  display: flex;
  background: var(--color-bg-secondary, #F8FAFC);
  border-bottom: 1px solid var(--color-border-light, #E2E8F0);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 3px solid transparent;
  position: relative;
}

.tab-item:hover {
  background: var(--color-primary-bg-subtle, rgba(8, 145, 178, 0.05));
}

.tab-item.active {
  background: var(--color-bg-primary, #ffffff);
  border-bottom-color: var(--color-primary, #0891B2);
}

.tab-icon {
  font-size: 18px;
  color: var(--color-text-secondary, #64748B);
  transition: all var(--transition-base);
}

.tab-item.active .tab-icon {
  color: var(--color-primary, #0891B2);
}

.tab-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #64748B);
  transition: all var(--transition-base);
}

.tab-item.active .tab-label {
  color: var(--color-text-primary, #164E63);
}

.tabs-content {
  padding: 24px;
}

.tab-panel {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 数据可视化区域 */
.chart-card {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.chart-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--color-primary, #0891B2);
}

.chart-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
  transform: translateY(-2px);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin: 0;
  transition: all var(--transition-base);
}

.chart-container {
  height: 300px;
  transition: all var(--transition-base);
  position: relative;
}

.chart-time-select {
  width: 120px;
  transition: all 0.3s var(--transition-base);
}

.chart-action-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 4px 8px;
}

.chart-action-btn:hover {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  transform: scale(1.05);
}

/* AI 分析区域 */
.ai-card {
  background: var(--color-bg-primary, #FFFFFF);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(8, 145, 178, 0.08);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.ai-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--color-primary, #3B82F6);
}

.ai-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
  transform: translateY(-2px);
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  transition: all var(--transition-base);
}

.ai-icon {
  color: #3B82F6;
  transition: all 0.3s var(--transition-base);
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3));
}

.ai-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin: 0;
  transition: all var(--transition-base);
}

.ai-tag {
  margin-left: auto;
  background: var(--color-primary, #3B82F6);
  border: none;
  color: white;
  animation: pulse 2s infinite;
}

.ai-content {
  margin-bottom: 24px;
  transition: all var(--transition-base);
}

.ai-loading {
  min-height: 300px;
  transition: all var(--transition-base);
}

.ai-summary-section,
.ai-insights-section,
.ai-weekly-tips-section,
.ai-next-stage-section,
.ai-metrics-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--color-bg-secondary, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.ai-summary-section:hover,
.ai-insights-section:hover,
.ai-weekly-tips-section:hover,
.ai-next-stage-section:hover,
.ai-metrics-section:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.08);
  border-color: #BAE6FD;
  transform: translateY(-2px);
}

.ai-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin: 0 0 16px 0;
  transition: all var(--transition-base);
}

.ai-section-title el-icon {
  color: var(--color-primary, #3B82F6);
  transition: all var(--transition-base);
}

.ai-summary,
.ai-weekly-tips,
.ai-next-stage {
  font-size: 14px;
  color: var(--color-text-primary, #334155);
  line-height: 1.6;
  transition: all var(--transition-base);
  background: var(--color-bg-primary, #ffffff);
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid var(--color-primary, #3B82F6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.ai-insights {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all var(--transition-base);
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: var(--color-bg-primary, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.insight-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background: var(--color-primary, #3B82F6);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s var(--transition-base);
}

.insight-item:hover {
  background: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05));
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.08);
  border-color: var(--color-border-medium, #BAE6FD);
  transform: translateX(4px);
}

.insight-item:hover::before {
  transform: scaleY(1);
}

.insight-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.1));
  color: var(--color-primary, #3B82F6);
  flex-shrink: 0;
  font-size: 20px;
  transition: all 0.3s var(--transition-base);
}

.insight-item:hover .insight-icon {
  background: var(--color-primary, #3B82F6);
  color: #fff;
}

.insight-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.insight-text {
  font-size: 14px;
  color: var(--color-text-primary, #334155);
  line-height: 1.6;
  font-weight: 500;
  transition: all var(--transition-base);
}

.insight-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #64748B);
  line-height: 1.5;
}

.insight-priority {
  flex-shrink: 0;
  margin-left: 8px;
  border-radius: 12px;
  padding: 2px 10px;
  font-weight: 600;
}

.ai-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  transition: all var(--transition-base);
}

.metric-item {
  text-align: center;
  padding: 16px;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--color-border-light, #E0F2FE);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.metric-item:hover {
  background: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  border-color: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
}

.metric-label {
  font-size: 12px;
  color: var(--color-text-secondary, #64748B);
  margin-bottom: 8px;
  transition: all var(--transition-base);
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary, #3B82F6);
  transition: all var(--transition-base);
}

.ai-role-suggestions-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--color-bg-primary, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.ai-role-suggestions-section:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.08);
  border-color: var(--color-border-medium, #BAE6FD);
  transform: translateY(-2px);
}

.ai-role-suggestions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all var(--transition-base);
}

.role-suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 8px;
  border-left: 4px solid var(--color-success, #22C55E);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.role-suggestion-item:hover {
  background: var(--color-success-light, rgba(34, 197, 94, 0.05));
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);
}

.suggestion-icon {
  color: var(--color-success, #22C55E);
  margin-top: 2px;
  flex-shrink: 0;
  transition: all 0.3s var(--transition-base);
}

.suggestion-text {
  flex: 1;
  font-size: 14px;
  color: var(--color-text-primary, #334155);
  line-height: 1.5;
  transition: all var(--transition-base);
}

.ai-trend-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--color-bg-primary, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.ai-trend-section:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.08);
  border-color: var(--color-border-medium, #BAE6FD);
  transform: translateY(-2px);
}

.trend-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.trend-tag {
  font-size: 14px;
  font-weight: 600;
}

.trend-description {
  font-size: 14px;
  color: var(--color-text-secondary, #64748B);
}

.trend-chart-container {
  margin-top: 16px;
}

.trend-chart {
  height: 250px;
  width: 100%;
}

.ai-history-section {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--color-bg-primary, #FFFFFF);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.ai-history-section:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.08);
  border-color: var(--color-border-medium, #BAE6FD);
  transform: translateY(-2px);
}

.ai-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--color-border-light, #f1f5f9);
}

.history-item:hover {
  background: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05));
  transform: translateX(4px);
  border-color: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
}

.history-week {
  min-width: 80px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
}

.history-completion {
  flex: 1;
}

.history-counts {
  min-width: 60px;
  text-align: right;
  color: var(--color-text-secondary, #64748B);
}

.completed {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success, #22C55E);
}

.ai-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  transition: all var(--transition-base);
  padding-top: 20px;
  border-top: 1px solid var(--color-border-light, #f1f5f9);
}

.refresh-btn, .export-btn, .detail-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
}

.refresh-btn:hover, .export-btn:hover, .detail-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

/* 最近活动区域 */
.activity-card {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light, #E0F2FE);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.activity-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: var(--color-border-medium, #BAE6FD);
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-light, #f1f5f9);
  transition: all 0.3s var(--transition-base);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  transform: translateX(8px);
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s var(--transition-base);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.activity-content {
  flex: 1;
  transition: all var(--transition-base);
}

.activity-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin-bottom: 4px;
  transition: all var(--transition-base);
}

.activity-description {
  font-size: 13px;
  color: var(--color-text-secondary, #64748B);
  margin-bottom: 8px;
  transition: all var(--transition-base);
}

.activity-time {
  font-size: 12px;
  color: var(--color-text-tertiary, #94A3B8);
  transition: all var(--transition-base);
}

.activity-status {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s var(--transition-base);
}

.activity-status.success {
  background: var(--color-success-light, rgba(34, 197, 94, 0.15));
  color: var(--color-success, #22C55E);
  border: 1px solid var(--color-success-light, rgba(34, 197, 94, 0.3));
}

.activity-status.warning {
  background: var(--color-warning-light, rgba(245, 158, 11, 0.15));
  color: var(--color-warning, #F59E0B);
  border: 1px solid var(--color-warning-light, rgba(245, 158, 11, 0.3));
}

.activity-status.info {
  background: var(--color-primary-bg, rgba(59, 130, 246, 0.15));
  color: var(--color-primary, #3B82F6);
  border: 1px solid var(--color-primary-bg, rgba(59, 130, 246, 0.3));
}

:root.dark-mode .activity-status.success {
  background: rgba(16, 185, 129, 0.25);
  color: #6EE7B7;
  border-color: rgba(16, 185, 129, 0.5);
}
:root.dark-mode .activity-status.warning {
  background: rgba(245, 158, 11, 0.25);
  color: #FCD34D;
  border-color: rgba(245, 158, 11, 0.5);
}
:root.dark-mode .activity-status.info {
  background: rgba(59, 130, 246, 0.25);
  color: #93C5FD;
  border-color: rgba(59, 130, 246, 0.5);
}

:root.dark-mode .guideline-card {
  background: linear-gradient(to right, rgba(8, 145, 178, 0.1), rgba(15, 23, 42, 0.6));
  border-left: 4px solid #0891B2;
  border-top: 1px solid #1E293B;
  border-right: 1px solid #1E293B;
  border-bottom: 1px solid #1E293B;
}

:root.dark-mode .guideline-card.is-empty {
  background: rgba(15, 23, 42, 0.4);
  border-left-color: #475569;
}

:root.dark-mode .guideline-content {
  color: #E2E8F0;
}

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

  .primary-actions {
    width: 100%;
    flex-direction: column;
  }

  .welcome-greeting h1 {
    font-size: 22px;
  }

  .welcome-greeting p {
    font-size: 14px;
  }

  .create-btn, .secondary-btn {
    width: 100%;
    height: 44px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card-content {
    flex-direction: column;
    text-align: center;
  }

  .stat-num {
    font-size: 24px;
  }

  .chart-container {
    height: 220px;
  }

  .insight-item {
    padding: 12px;
  }

  .insight-text {
    font-size: 13px;
  }

  .ai-footer {
    flex-direction: column;
  }

  .refresh-btn, .export-btn, .detail-btn {
    width: 100%;
  }

  .activity-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .activity-status {
    align-self: flex-start;
  }

  .ai-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-value {
    font-size: 18px;
  }

  .metric-label {
    font-size: 11px;
  }

  .tabs-header {
    flex-direction: column;
  }

  .tab-item {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .dashboard {
    padding: 12px;
  }

  .welcome-content {
    padding: 20px;
    gap: 16px;
  }

  .welcome-greeting h1 {
    font-size: 20px;
  }

  .welcome-greeting p {
    font-size: 13px;
  }

  .create-btn, .secondary-btn {
    height: 40px;
    font-size: 14px;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-num {
    font-size: 22px;
  }

  .chart-container {
    height: 200px;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .ai-section-title {
    font-size: 13px;
  }

  .ai-summary, .ai-weekly-tips, .ai-next-stage {
    font-size: 13px;
    padding: 12px;
  }
}

:deep(.el-select-dropdown__item) {
  color: var(--color-text-primary, #164E63);
}

:deep(.el-select-dropdown__item.hover),
:deep(.el-select-dropdown__item:hover) {
  background-color: var(--color-bg-secondary, #F8FAFC);
}
</style>