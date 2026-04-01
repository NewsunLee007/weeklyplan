import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '../utils/request'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  async function login(username, password) {
    const data = await request.post('/auth/login', { username, password })
    token.value = data.token
    userInfo.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('userInfo', JSON.stringify(data.user))
    return data
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  async function fetchInfo() {
    const data = await request.get('/auth/info')
    userInfo.value = data
    localStorage.setItem('userInfo', JSON.stringify(data))
    return data
  }

  return { token, userInfo, login, logout, fetchInfo }
})
