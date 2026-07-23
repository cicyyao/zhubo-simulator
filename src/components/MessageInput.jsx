import { useState } from 'react'

export default function MessageInput({ onSend, loading, disabled }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim() || loading || disabled) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? '等待后端服务就绪...' : '输入消息...'}
        rows={1}
        disabled={loading || disabled}
      />
      <button
        className="btn-send"
        onClick={handleSend}
        disabled={!text.trim() || loading || disabled}
      >
        {loading ? '...' : '发送'}
      </button>
    </div>
  )
}
