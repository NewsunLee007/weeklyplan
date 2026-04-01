/**
 * Axios 封装
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// 根据环境设置API基础URL
const isProduction = import.meta.env.PROD
const request = axios.create({
  baseURL: isProduction ? '/api' : 'http://localhost:3001/api',
  timeout: 15000
})

// 请求拦截器：附加 Token
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
request.interceptors.response.use(
  res => {
    // 文件下载直接返回
    if (res.config.responseType === 'blob') return res
    const { code, message, data } = res.data
    if (code === 200) return data
    ElMessage.error(message || '请求失败')
    return Promise.reject(new Error(message))
  },
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else if (import.meta.env.DEV) {
      // 开发环境下静默处理错误，使用模拟数据
      console.log('开发环境网络错误:', err.message)
    } else {
      ElMessage.error(err.response?.data?.message || '网络请求失败')
    }
    return Promise.reject(err)
  }
)

export default request
