/**
 * 企业微信推送服务
 */
const axios = require('axios');
const { queryOne } = require('../db/database');

async function getWebhookUrl() {
  const cfg = queryOne(`SELECT config_value FROM sys_config WHERE config_key='wechat_webhook_url'`);
  return cfg?.config_value || '';
}

async function sendMarkdown(content) {
  const url = await getWebhookUrl();
  if (!url) {
    console.log('[企微推送] Webhook URL 未配置，跳过');
    return;
  }
  try {
    await axios.post(url, {
      msgtype: 'markdown',
      markdown: { content }
    });
    console.log('[企微推送] 发送成功');
  } catch (e) {
    console.error('[企微推送] 发送失败', e.message);
  }
}

async function notifyPublished(plan) {
  const sd = new Date(plan.start_date);
  const ed = new Date(plan.end_date);
  const dateRange = `${sd.getMonth() + 1}.${sd.getDate()}-${ed.getMonth() + 1}.${ed.getDate()}`;
  const content = `## 📋 周工作行事历已发布
> **第${plan.week_number}周（${dateRange}）**周工作行事历已通过全部审核。
> 各部门请及时查看并按计划执行。
> [点击查看详情](http://localhost:5173/plan/published)`;
  return sendMarkdown(content);
}

module.exports = { notifyPublished, sendMarkdown };
