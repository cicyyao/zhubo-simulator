export default function ChatHeader({ name, avatarUrl, status, onReset }) {
  return (
    <div className="chat-header">
      <div className="chat-header-left">
        <div className="chat-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} />
          ) : (
            <span className="chat-avatar-text">{name[0]}</span>
          )}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{name}</div>
          <div className={`chat-header-status ${status === '离线' ? 'offline' : ''}`}>
            {status}
          </div>
        </div>
      </div>
      <button className="btn-reset" onClick={onReset} title="重置对话">
        ↺
      </button>
    </div>
  )
}
