import { useState, useRef, useEffect } from 'react'
import ChatHeader from './components/ChatHeader.jsx'
import MessageList from './components/MessageList.jsx'
import MessageInput from './components/MessageInput.jsx'

const DEFAULT_PROFILE = {
  name: '她',
  avatar: '',
  status: '在线',
  bio: '请先在 materials/人物设定.json 中填写信息',
}

function getAvatarUrl(profile) {
  if (profile.avatar && profile.avatar.startsWith('http')) return profile.avatar
  return null
}

export default function App() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [configured, setConfigured] = useState(null)
  const [messages, setMessages] = useState([
    { role: 'system', content: '正在检查服务状态...' },
  ])
  const [loading, setLoading] = useState(false)
  const checked = useRef(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConfigured(data.configured)
      setProfile(prev => ({ ...prev, name: data.profileName || '她' }))
      if (!data.configured) {
        setMessages([
          { role: 'system', content: '⚠️ API密钥未配置' },
          { role: 'assistant', content: '请先编辑 backend/.env 文件，填入你的 DEEPSEEK_API_KEY，然后重启后端服务。\n\n配置好后刷新页面即可开始对话。', isError: false },
        ])
      } else {
        setMessages([
          { role: 'system', content: `已载入「${data.profileName || '她'}」模拟器，开始对话吧。` },
        ])
      }
    } catch {
      setConfigured(false)
      setMessages([
        { role: 'system', content: '⚠️ 无法连接到后端服务' },
        { role: 'assistant', content: '后端服务未启动。请打开另一个终端，运行：\n\n  cd backend && node server.js\n\n然后刷新页面。', isError: false },
      ])
    }
  }

  const sendMessage = async (text) => {
    if (!text.trim() || loadingRef.current) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    loadingRef.current = true

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newMessages.filter(m => m.role !== 'system'),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败 (${res.status})`)
      }

      const data = await res.json()
      const replies = data.replies || [data.reply]

      // 逐条显示消息，模拟打字间隔
      for (let i = 0; i < replies.length; i++) {
        await new Promise(r => setTimeout(r, i === 0 ? 300 : 600 + Math.random() * 400))
        setMessages(prev => [...prev, { role: 'assistant', content: replies[i] }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${err.message}`,
        isError: true,
      }])
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const resetChat = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' })
      setMessages([{ role: 'system', content: '已重置对话。' }])
    } catch {
      setMessages([{ role: 'system', content: '已重置对话。' }])
    }
  }

  return (
    <div className="app">
      <ChatHeader
        name={profile.name}
        avatarUrl={getAvatarUrl(profile)}
        status={configured === null ? '检查中...' : (configured ? '已就绪' : '未配置')}
        onReset={resetChat}
      />
      <MessageList messages={messages} userName="我" botName={profile.name} />
      <MessageInput onSend={sendMessage} loading={loading} disabled={!configured} />
    </div>
  )
}
