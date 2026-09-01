import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

function ChatMessage({ msg, botName }) {
  const isBot = msg.role === 'bot';
  return (
    <div className={`cb-msg ${isBot ? 'cb-bot' : 'cb-user'}`}>
      {isBot && <div className="cb-avatar">🤖</div>}
      <div className="cb-bubble">
        {isBot && <div className="cb-botname">{botName}</div>}
        <div className="cb-text">{msg.text}</div>
      </div>
    </div>
  );
}

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [botCfg, setBotCfg] = useState({ botName: 'Toto Assist', greeting: '', quickReplies: [] });
  const [unread, setUnread] = useState(0);
  const bodyRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    client.get('/chatbot-config').then(({ data }) => {
      const cfg = data.chatbotConfig || {};
      setBotCfg(cfg);
      if (!startedRef.current) {
        startedRef.current = true;
        setMessages([{ role: 'bot', text: cfg.greeting || 'Hi! 👋 How can I help you?' }]);
        setQuickReplies(cfg.quickReplies || []);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open && unread > 0) return;
    if (open && unread > 0) setUnread(0);
  }, [open, unread]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || typing) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setTyping(true);
    try {
      const { data } = await client.post('/chatbot/message', { text: trimmed, role: user?.role || 'rider' });
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [...m, { role: 'bot', text: data.reply }]);
        if (Array.isArray(data.quickReplies) && data.quickReplies.length) setQuickReplies(data.quickReplies);
      }, 400);
    } catch {
      setTyping(false);
      setMessages((m) => [...m, { role: 'bot', text: 'Sorry, I am having trouble reaching the server right now. 😕 Please try again.' }]);
    }
  };

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) setUnread(0);
  };

  return (
    <>
      {!open && (
        <button className="cb-fab" onClick={toggle} aria-label="Chat assistant">
          {unread > 0 && <span className="cb-badge">{unread}</span>}
          <span className="cb-fab-icon">💬</span>
        </button>
      )}
      {open && (
        <div className="cb-window">
          <div className="cb-header">
            <span className="cb-header-avatar">🤖</span>
            <div className="cb-header-text">
              <div className="cb-title">{botCfg.botName}</div>
              <div className="cb-status"><span className="cb-dot" /> Online — ask me anything</div>
            </div>
            <button className="cb-close" onClick={toggle} aria-label="Close">✕</button>
          </div>
          <div className="cb-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <ChatMessage key={i} msg={m} botName={botCfg.botName} />
            ))}
            {typing && (
              <div className="cb-msg cb-bot">
                <div className="cb-avatar">🤖</div>
                <div className="cb-bubble cb-typing">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}
          </div>
          {quickReplies.length > 0 && (
            <div className="cb-quick">
              {quickReplies.map((q, i) => (
                <button key={i} className="cb-chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}
          <div className="cb-footer">
            <input
              className="cb-input"
              value={input}
              placeholder="Type your question…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="cb-send" onClick={() => send()} disabled={!input.trim() || typing} aria-label="Send">➤</button>
          </div>
        </div>
      )}
    </>
  );
}