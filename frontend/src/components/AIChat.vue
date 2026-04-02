<template>
  <div class="ai-chat-container">
    <div v-if="!isOpen" class="ai-chat-trigger" @click="toggleChat">
      <el-icon :size="28"><ChatDotRound /></el-icon>
    </div>
    
    <div v-else class="ai-chat-window">
      <div class="ai-chat-header">
        <div class="ai-chat-title">
          <el-icon class="ai-icon"><ChatDotRound /></el-icon>
          <span>AI 智能助手</span>
        </div>
        <div class="ai-chat-actions">
          <el-button link size="small" @click="clearChat">
            <el-icon><Delete /></el-icon>
          </el-button>
          <el-button link size="small" @click="toggleChat">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
      
      <div class="ai-chat-messages" ref="messagesRef">
        <div v-if="messages.length === 0" class="ai-chat-empty">
          <el-icon :size="48" class="empty-icon"><ChatDotRound /></el-icon>
          <p>有什么可以帮助您的？</p>
        </div>
        
        <div v-for="(msg, index) in messages" :key="index" class="ai-chat-message" :class="msg.role">
          <div class="message-avatar">
            <el-icon v-if="msg.role === 'user'"><User /></el-icon>
            <el-icon v-else><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-text">{{ msg.content }}</div>
          </div>
        </div>
        
        <div v-if="loading" class="ai-chat-message assistant">
          <div class="message-avatar">
            <el-icon><ChatDotRound /></el-icon>
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
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="2"
          placeholder="输入您的问题..."
          @keydown.enter.prevent="sendMessage"
        />
        <el-button type="primary" :loading="loading" @click="sendMessage">
          <el-icon><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { ChatDotRound, User, Close, Delete, Promotion } from '@element-plus/icons-vue'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const isOpen = ref(false)
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const aiConfig = ref({
  chatEnabled: true
})

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

async function sendMessage() {
  if (!inputMessage.value.trim() || loading.value) return
  
  if (!aiConfig.value.chatEnabled) {
    ElMessage.warning('AI对话功能未启用，请联系管理员配置')
    return
  }
  
  const userMessage = inputMessage.value.trim()
  messages.value.push({
    role: 'user',
    content: userMessage
  })
  
  inputMessage.value = ''
  loading.value = true
  
  nextTick(() => scrollToBottom())
  
  try {
    const response = await request.post('/ai/chat', {
      messages: messages.value.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
    
    messages.value.push({
      role: 'assistant',
      content: response.message
    })
  } catch (error) {
    console.error('发送消息失败:', error)
    ElMessage.error(error.message || '发送消息失败')
    messages.value.push({
      role: 'assistant',
      content: '抱歉，我遇到了一些问题。请稍后再试或联系管理员。'
    })
  } finally {
    loading.value = false
    nextTick(() => scrollToBottom())
  }
}

function clearChat() {
  messages.value = []
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

onMounted(() => {
  fetchAIConfig()
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
  width: 420px;
  height: 600px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.ai-icon {
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ai-chat-actions .el-button {
  color: white;
  padding: 4px;
}

.ai-chat-actions .el-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ai-chat-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: #F8FAFC;
}

.ai-chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94A3B8;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.ai-chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-chat-message.user .message-avatar {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
}

.message-content {
  max-width: 70%;
}

.message-text {
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  color: #1E293B;
  line-height: 1.6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  word-wrap: break-word;
}

.ai-chat-message.user .message-text {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
  color: white;
}

.message-loading {
  display: flex;
  gap: 4px;
  padding: 16px;
}

.message-loading .dot {
  width: 8px;
  height: 8px;
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
  padding: 16px;
  background: white;
  border-top: 1px solid #E2E8F0;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.ai-chat-input .el-textarea {
  flex: 1;
}

.ai-chat-input .el-button {
  height: 76px;
  padding: 0 20px;
  border-radius: 8px;
}
</style>
