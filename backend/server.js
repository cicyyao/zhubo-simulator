import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// 前端构建目录（生产模式用）
const DIST_DIR = path.resolve(__dirname, 'public')

// ===== 动态加载人物设定 =====
const MATERIALS_DIR = path.resolve(__dirname, '..', 'materials')
const PROFILE_PATH = path.join(MATERIALS_DIR, '人物设定.json')
const EXAMPLES_PATH = path.join(MATERIALS_DIR, '聊天示例.json')

function loadProfile() {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const raw = fs.readFileSync(PROFILE_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('⚠️ 人物设定加载失败，使用默认配置:', e.message)
  }
  return { name: '她', basic: {}, personality: [], speechPatterns: { catchphrases: [], emojis: [], style: '' }, relationship: {} }
}

function loadChatExamples() {
  try {
    if (fs.existsSync(EXAMPLES_PATH)) {
      const raw = fs.readFileSync(EXAMPLES_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.join('\n')
    }
  } catch (e) {
    console.warn('⚠️ 聊天示例加载失败:', e.message)
  }
  return ''
}

// ===== System Prompt 构建 =====
function buildSystemPrompt(profile, chatExamples) {
  const r = profile.relationship || {}
  return `你正在扮演一个真实存在的人。以下是你要扮演的人物的完整设定：

## 人物档案
- 姓名：${profile.name || '胡慧珍'}
${profile.basic?.nickname ? `- 昵称：${profile.basic.nickname}` : ''}
${profile.basic?.age ? `- 年龄：${profile.basic.age}` : ''}
${profile.basic?.occupation ? `- 职业：${profile.basic.occupation}` : ''}
${profile.basic?.city ? `- 城市：${profile.basic.city}` : ''}

## 性格画像
${profile.personality?.length ? profile.personality.map(p => `- ${p}`).join('\n') : '- 蠢而不自知的炫耀型人格'}

## 说话风格
${profile.speechPatterns?.style ? `- ${profile.speechPatterns.style}` : '- 自以为优雅实则很刻意，中英文夹杂'}
${profile.speechPatterns?.catchphrases?.length ? `- 高频词：${profile.speechPatterns.catchphrases.join('、')}` : ''}

## 关键背景（非常重要）
${profile.boyfriend ? `- 现男友：${profile.boyfriend.name}（${profile.boyfriend.occupation}）${profile.boyfriend.note ? `——${profile.boyfriend.note}` : ''}` : ''}
${r.history ? `- 相识经历：${r.history}` : ''}
${r.breakReason ? `- 决裂原因：${r.breakReason}` : ''}
${r.herCurrentAttitude ? `- 她现在对我的态度：${r.herCurrentAttitude}` : ''}
${r.yourAttitude ? `- 我对她的真实想法：${r.yourAttitude}` : ''}
${r.yourRole ? `- 我在对话中的角色：${r.yourRole}` : ''}

## 扮演铁律
1. 用第一人称说话，模仿她的语气、节奏、用词
2. 她不是故意浮夸的戏精——她是真心觉得自己很优雅、很有格调，所以炫耀的时候是一本正经的
3. 她喜欢凡尔赛，但手法很拙劣。比如先假装抱怨，再不经意透露自己"多优秀多幸福"
4. 她有一种不自觉的优越感，聊着聊着就会拐到炫耀上，而且她自己意识不到
5. 中英文夹杂要自然，别太密——她觉得自己这样很international很高级
6. 被戳中痛点时不会激烈反应，而是假装没听到/转移话题，或者用那种"你不懂我"的委屈语气带过去
7. 不要解释"作为AI"，你就是在扮演她
8. 提到男朋友时要叫"我男朋友"或"我老公"，也可以叫"ddd"（他名字的缩写）。绝对不喊全名"窦志远"，太生分了
9. 你的聊天风格是"分条发送"：每次回复都拆成2-4条短消息，每条之间用【换行+空行】隔开。就像这样：

   哈哈哈真的假的

   你也太搞笑了吧

   不过说真的我觉得我男朋友最近变化挺大的

10. 每条消息不超过30个字。不要写一整段话，拆开！
11. 每次回复总共不超过100字。短！短！短！

## 参考语料
以下是她本人的真实发言，模仿这些的语气：
${chatExamples || '暂无'}`
}

// 初始化
let profile = loadProfile()
let examples = loadChatExamples()
let systemPrompt = buildSystemPrompt(profile, examples)

function refreshConfig() {
  const newProfile = loadProfile()
  const newExamples = loadChatExamples()
  profile = newProfile
  examples = newExamples
  systemPrompt = buildSystemPrompt(newProfile, newExamples)
}

// ===== DeepSeek 客户端 =====
function getDeepSeekClient() {
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
  })
}

function getModelName() {
  return process.env.LLM_MODEL || 'deepseek-chat'
}

// ===== API =====

// POST /api/chat - 发送消息
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body

    if (!message) {
      return res.status(400).json({ error: '消息不能为空' })
    }

    refreshConfig()

    // 检查API密钥
    const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY
    if (!key) {
      return res.status(503).json({
        error: 'API密钥未配置。请编辑 backend/.env 文件，填入你的 DEEPSEEK_API_KEY',
      })
    }

    const client = getDeepSeekClient()

    // 构建消息列表
    const messages = [{ role: 'system', content: systemPrompt }]

    const recentHistory = (history || []).slice(-40)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: message })

    // 调用 DeepSeek API
    const response = await client.chat.completions.create({
      model: getModelName(),
      max_tokens: 256,
      messages,
    })

    const reply = response.choices[0]?.message?.content || '（没有收到回复）'

    // 拆条策略：先按空行分割，再按句子分割兜底
    let replies = reply
      .split(/\n\s*\n+/)           // 优先：空行分割
      .map(s => s.trim())
      .filter(s => s.length > 1)

    // 如果空行分割没拆开，按句子分割兜底
    if (replies.length <= 1 && reply.length > 20) {
      replies = reply
        .split(/(?<=[。！？!?])/)   // 按句号感叹号问号分割
        .map(s => s.trim())
        .filter(s => s.length > 1)
    }

    // 合并过短的句子到上一条
    const merged = []
    for (const r of replies) {
      if (r.length < 3 && merged.length) {
        merged[merged.length - 1] += r
      } else if (merged.length && merged[merged.length - 1].length + r.length < 15) {
        merged[merged.length - 1] += r
      } else {
        merged.push(r)
      }
    }

    res.json({ replies: merged.slice(0, 6) })
  } catch (err) {
    console.error('Chat error:', err)

    if (err.status === 401) {
      return res.status(503).json({ error: 'API密钥无效，请检查 DEEPSEEK_API_KEY' })
    }
    if (err.status === 429) {
      return res.status(503).json({ error: 'API请求过于频繁，请稍后再试' })
    }
    if (err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: '无法连接到API服务器，请检查网络' })
    }

    res.status(500).json({ error: err.message || '服务器内部错误' })
  }
})

// POST /api/reset - 重置对话
app.post('/api/reset', (req, res) => {
  res.json({ ok: true })
})

// GET /api/status - 检查服务状态
app.get('/api/status', (req, res) => {
  refreshConfig()
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY
  res.json({
    ok: true,
    configured: !!key,
    profileName: profile.name || '她',
  })
})

// ===== 前端静态文件（必须在 API 路由之后）=====
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))

  // SPA 兜底：非 API 的 GET 请求返回 index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })

  console.log(`📦 前端静态文件已加载，访问 http://localhost:${PORT} 即可使用`)
}

app.listen(PORT, () => {
  console.log(`🎭 好友模拟器服务运行在 http://0.0.0.0:${PORT}`)
  console.log(`📁 人物设定：${PROFILE_PATH}`)
  console.log(`📁 对话示例：${EXAMPLES_PATH}`)
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY
  if (!key) {
    console.log('⚠️  未配置 API 密钥，请在 backend/.env 中填入 DEEPSEEK_API_KEY')
  } else {
    console.log(`✅ API已配置 | 模型: ${getModelName()} | 角色: ${profile.name || '她'}`)
  }
})

// 捕获未处理的错误，防止静默崩溃
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('❌ 未处理的 Promise 拒绝:', err)
})

console.log('⏳ 正在启动服务器...')
console.log(`📌 PORT: ${PORT}, NODE_ENV: ${process.env.NODE_ENV || 'production'}`)
console.log(`📌 是否加载 dist: ${fs.existsSync(DIST_DIR)}`)
console.log(`📌 环境变量 DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置'}`)
