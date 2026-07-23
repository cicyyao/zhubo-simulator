import { useEffect, useRef } from 'react'

export default function MessageList({ messages, userName, botName }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isSystem = (msg) => msg.role === 'system'
  const isUser = (msg) => msg.role === 'user'

  return (
    <div className="message-list">
      {messages.map((msg, i) => {
        if (isSystem(msg)) {
          return (
            <div className="msg-system" key={i}>
              <span>{msg.content}</span>
            </div>
          )
        }
        const me = isUser(msg)
        return (
          <div className={`msg-row ${me ? 'msg-row-me' : 'msg-row-other'}`} key={i}>
            <div className="msg-bubble-wrapper">
              <div className={`msg-name ${me ? '' : 'msg-name-other'}`}>
                {me ? userName : botName}
              </div>
              <div className={`msg-bubble ${me ? 'msg-bubble-me' : 'msg-bubble-other'} ${msg.isError ? 'msg-error' : ''}`}>
                {msg.content}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
