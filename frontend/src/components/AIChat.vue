<template>
  <div class="ai-chat-container">
    <div v-if="!isOpen" class="ai-chat-trigger" @click="toggleChat">
      <el-icon :size="28"><ChatDotRound /></el-icon>
    </div>
    
    <div v-else class="ai-chat-window">
      <div class="ai-chat-header">
        <div class="ai-chat-title">
          <div class="ai-avatar">
            <el-icon :size="20"><ChatDotRound /></el-icon>
          </div>
          <div class="ai-info">
            <span class="ai-name">AI 智能助手</span>
            <span class="ai-status">在线</span>
          </div>
        </div>
        <div class="ai-chat-actions">
          <el-button link size="small" @click="clearChat" title="清空聊天">
            <el-icon><Delete /></el-icon>
          </el-button>
          <el-button link size="small" @click="toggleChat" title="最小化">
            <el-icon><Minus /></el-icon>
          </el-button>
          <el-button link size="small" @click="toggleChat" title="关闭">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
      
      <div class="ai-chat-messages" ref="messagesRef">
        <div v-if="messages.length === 0" class="ai-chat-empty">
          <div class="empty-welcome">
            <el-icon :size="64" class="empty-icon"><ChatDotRound /></el-icon>
            <h3>你好！很高兴为您服务</h3>
            <p>我可以帮助您：</p>
            <div class="quick-questions">
              <el-tag class="quick-tag" @click="sendQuickQuestion('帮我查看本周工作计划')">
                📅 制定工作计划和时间安排
              </el-tag>
              <el-tag class="quick-tag" @click="sendQuickQuestion('分析一下我的工作效率')">
                📊 分析任务优先级和工作效率
              </el-tag>
              <el-tag class="quick-tag" @click="sendQuickQuestion('有什么好的时间管理建议')">
                💡 提供时间管理和工作方法建议
              </el-tag>
              <el-tag class="quick-tag" @click="sendQuickQuestion('帮我整理一下待办事项')">
                📝 整理待办事项和进度跟踪
              </el-tag>
              <el-tag class="quick-tag" @click="sendQuickQuestion('最近的工作安排有哪些')">
                🔍 查看近期工作计划和行事历
              </el-tag>
            </div>
          </div>
        </div>
        
        <div v-for="(msg, index) in messages" :key="index" class="ai-chat-message" :class="msg.role">
          <div class="message-avatar">
            <el-avatar v-if="msg.role === 'user'" :size="36" class="user-avatar">
              {{ userInitial }}
            </el-avatar>
            <div v-else class="ai-message-avatar">
              <el-icon :size="20"><ChatDotRound /></el-icon>
            </div>
          </div>
          <div class="message-content">
            <div class="message-text" v-html="formatMessage(msg.content)"></div>
            <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
          </div>
        </div>
        
        <div v-if="loading" class="ai-chat-message assistant">
          <div class="message-avatar">
            <div class="ai-message-avatar">
              <el-icon :size="20"><ChatDotRound /></el-icon>
            </div>
          </div>
          <div class="message-content">
            <div class="message-loading">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="ai-chat-input">
        <div class="input-wrapper">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="输入您的问题..."
            @keydown="handleKeyDown"
            class="chat-textarea"
          />
        </div>
        <el-button 
          type="primary" 
          :loading="loading" 
          @click="sendMessage"
          class="send-button"
          :disabled="!inputMessage.trim()"
        >
          <el-icon><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, computed } from 'vue'
import { ChatDotRound, User, Close, Delete, Promotion, Minus } from '@element-plus/icons-vue'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const userInitial = computed(() => {
  const name = userStore.userInfo?.real_name || userStore.userInfo?.realName || '用户'
  return name.charAt(0).toUpperCase()
})

const isOpen = ref(false)
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const aiConfig = ref({
  chatEnabled: true
})

const STORAGE_KEY = 'ai_chat_history'

function toggleChat() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}

async function fetchAIConfig() {
  try {
    const config = await request.get('/ai/config')
    console.log('获取到的AI配置:', config)
    aiConfig.value = {
      chatEnabled: config.chatEnabled !== false,
      analysisEnabled: config.analysisEnabled !== false,
      suggestionsEnabled: config.suggestionsEnabled !== false
    }
  } catch (error) {
    console.error('获取AI配置失败:', error)
    aiConfig.value = {
      chatEnabled: true,
      analysisEnabled: true,
      suggestionsEnabled: true
    }
  }
}

function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
  } catch (error) {
    console.error('保存聊天历史失败:', error)
  }
}

function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      messages.value = JSON.parse(saved)
    }
  } catch (error) {
    console.error('加载聊天历史失败:', error)
  }
}

function formatMessage(content) {
  // Remove markdown formatting
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // Remove links
    .replace(/^-\s/gm, '• '); // Convert bullet points
  
  return formatted
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return date.toLocaleDateString('zh-CN', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function sendQuickQuestion(question) {
  inputMessage.value = question
  sendMessage()
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

async function sendMessage() {
  if (!inputMessage.value.trim() || loading.value) return
  
  if (!aiConfig.value.chatEnabled) {
    ElMessage.warning('AI对话功能未启用，请联系管理员配置')
    return
  }
  
  const userMessage = inputMessage.value.trim()
  messages.value.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  })
  
  inputMessage.value = ''
  loading.value = true
  
  nextTick(() => scrollToBottom())
  saveChatHistory()
  
  try {
    const response = await request.post('/ai/chat', {
      messages: messages.value.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
    
    messages.value.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('发送消息失败:', error)
    ElMessage.error(error.message || '发送消息失败')
    messages.value.push({
      role: 'assistant',
      content: '抱歉，我遇到了一些问题。请稍后再试或联系管理员。',
      timestamp: new Date().toISOString()
    })
  } finally {
    loading.value = false
    nextTick(() => scrollToBottom())
    saveChatHistory()
  }
}

function clearChat() {
  ElMessageBox.confirm('确定要清空聊天记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    messages.value = []
    saveChatHistory()
    ElMessage.success('聊天记录已清空')
  }).catch(() => {})
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

onMounted(() => {
  fetchAIConfig()
  loadChatHistory()
})
</script>

<style scoped>
.ai-chat-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
}

.ai-chat-trigger {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: pulse 2s infinite;
}

.ai-chat-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.6);
  }
}

.ai-chat-window {
  width: 480px;
  height: 700px;
  background: #FFFFFF;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ai-chat-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-chat-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-info {
  display: flex;
  flex-direction: column;
}

.ai-name {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}

.ai-status {
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.3;
}

.ai-chat-actions .el-button {
  color: white;
  padding: 6px;
}

.ai-chat-actions .el-button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.ai-chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%);
}

.ai-chat-messages::-webkit-scrollbar {
  width: 6px;
}

.ai-chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.ai-chat-messages::-webkit-scrollbar-thumb {
  background: #CBD5E1;
  border-radius: 3px;
}

.ai-chat-messages::-webkit-scrollbar-thumb:hover {
  background: #94A3B8;
}

.ai-chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.empty-welcome {
  max-width: 100%;
}

.empty-icon {
  color: #3B82F6;
  margin-bottom: 24px;
  opacity: 0.3;
}

.empty-welcome h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1E293B;
  margin: 0 0 8px 0;
}

.empty-welcome p {
  font-size: 14px;
  color: #64748B;
  margin: 0 0 20px 0;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.quick-tag {
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 20px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  color: #475569;
  font-size: 13px;
  transition: all 0.2s;
}

.quick-tag:hover {
  background: #DBEAFE;
  border-color: #3B82F6;
  color: #3B82F6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.ai-chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
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

.ai-chat-message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
}

.ai-message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-content {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-chat-message.user .message-content {
  align-items: flex-end;
}

.message-text {
  padding: 14px 18px;
  background: white;
  border-radius: 16px;
  color: #1E293B;
  line-height: 1.7;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  word-wrap: break-word;
  font-size: 14px;
  border: 1px solid #F1F5F9;
}

.ai-chat-message.user .message-text {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.message-time {
  font-size: 11px;
  color: #94A3B8;
  padding: 0 4px;
}

.message-loading {
  display: flex;
  gap: 6px;
  padding: 14px 18px;
  background: white;
  border-radius: 16px;
  border: 1px solid #F1F5F9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.message-loading .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3B82F6;
  animation: bounce 1.4s infinite ease-in-out both;
}

.message-loading .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.message-loading .dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.ai-chat-input {
  padding: 16px 20px;
  background: #FFFFFF;
  border-top: 1px solid #E2E8F0;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-wrapper {
  flex: 1;
}

.chat-textarea :deep(.el-textarea__inner) {
  border-radius: 12px;
  border: 2px solid #E2E8F0;
  background: #F8FAFC;
  transition: all 0.2s;
  resize: none;
  font-size: 14px;
  padding: 12px 16px;
}

.chat-textarea :deep(.el-textarea__inner:focus) {
  border-color: #3B82F6;
  background: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.send-button {
  height: auto;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  border: none;
  font-weight: 500;
  transition: all 0.2s;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
