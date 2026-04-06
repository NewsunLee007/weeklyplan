<template>
  <div class="login-page">
    <div class="background-wrapper">
      <div class="glass-layer"></div>
    </div>
    
    <div class="login-card glassmorphism">
      <div class="logo-container">
        <img src="https://p.ipic.vip/lmzked.jpg" alt="Logo" class="logo-img" />
      </div>
      <div class="school-name">上海新纪元教育集团瑞安总校</div>
      <div class="system-name">周工作计划管理系统</div>
      
      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="handleLogin" class="login-form">
        <el-form-item prop="username" class="form-item-custom">
          <el-input
            v-model="form.username"
            size="large"
            placeholder="用户名 / 手机号 / 姓名"
            :prefix-icon="User"
            clearable
            class="custom-input"
          />
        </el-form-item>
        <el-form-item prop="password" class="form-item-custom">
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
            class="custom-input"
          />
        </el-form-item>
        
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          {{ loading ? '登录中...' : '登 录' }}
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入账号/手机号/姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e) {
    // error handled by axios interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background-color: #0f172a;
}

.background-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  z-index: 0;
  animation: bgZoom 20s infinite alternate ease-in-out;
}

@keyframes bgZoom {
  0% { transform: scale(1); }
  100% { transform: scale(1.05); }
}

.glass-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 58, 138, 0.6) 100%);
  backdrop-filter: blur(8px);
}

.glassmorphism {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 20px rgba(255, 255, 255, 0.1) inset;
}

.login-card {
  border-radius: 24px;
  padding: 48px 40px;
  width: 420px;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.3), 0 0 25px rgba(255, 255, 255, 0.2) inset;
}

.logo-container {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: #fff;
  padding: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.school-name {
  font-size: 14px;
  color: #475569;
  text-align: center;
  margin-bottom: 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.system-name {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-text-primary, #0f172a);
  text-align: center;
  margin-bottom: 40px;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--color-primary-dark, #1e3a8a), var(--color-primary, #3b82f6));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.login-form {
  width: 100%;
}

.form-item-custom {
  margin-bottom: 24px;
}

.custom-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02) !important;
  padding: 8px 15px;
  transition: all 0.3s ease;
  background-color: var(--color-bg-primary, rgba(255, 255, 255, 0.9));
}

.custom-input :deep(.el-input__inner) {
  color: var(--color-text-primary, #1e293b) !important;
}

.custom-input :deep(.el-input__inner::placeholder) {
  color: var(--color-text-tertiary, #94a3b8) !important;
}

.custom-input :deep(.el-input__prefix-inner) {
  color: var(--color-text-secondary, #64748b) !important;
}

.custom-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6) !important;
  background-color: var(--color-bg-primary, #fff);
}

.login-btn {
  width: 100%;
  border-radius: 12px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-top: 10px;
  background: var(--color-primary, #3b82f6);
  border: none;
  box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5);
  transition: all 0.3s ease;
  color: white;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -10px rgba(59, 130, 246, 0.6);
}

.login-btn:active {
  transform: translateY(0);
}
</style>
