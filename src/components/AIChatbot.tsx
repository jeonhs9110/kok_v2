'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Send, Bot, ArrowRight, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_EN = [
  'What products do you recommend for dry skin?',
  'Tell me about your best sellers',
  'How does international shipping work?',
  'What ingredients are in your serums?',
];

const SUGGESTED_KR = [
  '건성 피부에 추천하는 제품이 있나요?',
  '베스트셀러 제품을 알려주세요',
  '해외 배송은 어떻게 되나요?',
  '세럼에 어떤 성분이 들어있나요?',
];

const LABELS: Record<string, {
  chatPlaceholder: string;
  greeting: string;
  poweredBy: string;
  suggested: string;
  emailPrompt: string;
  emailPlaceholder: string;
  namePlaceholder: string;
  skinTypePlaceholder: string;
  countryPlaceholder: string;
  submit: string;
  thanks: string;
  skip: string;
  error: string;
  copied: string;
}> = {
  kr: {
    chatPlaceholder: '메시지를 입력하세요...',
    greeting: '안녕하세요! 콕콕가든 AI 뷰티 컨설턴트입니다.\n\n피부 타입이나 고민을 알려주시면 맞춤 제품을 추천해드릴게요. 배송, 성분, 교환/환불 등 무엇이든 물어보세요!',
    poweredBy: 'AI Beauty Consultant',
    suggested: '자주 묻는 질문',
    emailPrompt: '더 자세한 상담을 위해 연락처를 남겨주시겠어요?',
    emailPlaceholder: '이메일',
    namePlaceholder: '이름',
    skinTypePlaceholder: '피부 타입 (건성/지성/복합/민감)',
    countryPlaceholder: '국가',
    submit: '제출',
    thanks: '감사합니다! 정보가 저장되었습니다. 담당자가 확인 후 연락드리겠습니다.',
    skip: '건너뛰기',
    error: '죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
    copied: '복사됨',
  },
  en: {
    chatPlaceholder: 'Type your message...',
    greeting: 'Hello! I\'m your KOKKOK Garden AI Beauty Consultant.\n\nTell me about your skin type or concerns and I\'ll recommend the perfect products. Ask about shipping, ingredients, or anything else!',
    poweredBy: 'AI Beauty Consultant',
    suggested: 'Popular questions',
    emailPrompt: 'I\'d like to connect you with our support team. Could you share your contact info?',
    emailPlaceholder: 'Email',
    namePlaceholder: 'Name',
    skinTypePlaceholder: 'Skin type (dry/oily/combo/sensitive)',
    countryPlaceholder: 'Country',
    submit: 'Submit',
    thanks: 'Thank you! Our team will follow up with you shortly.',
    skip: 'Skip',
    error: 'Sorry, something went wrong. Please try again.',
    copied: 'Copied',
  },
};

// Keywords that signal escalation → show contact form
const ESCALATION_KEYWORDS = [
  'connect', 'support', 'human', 'agent', 'help me', 'complaint', 'refund', 'return',
  'damaged', 'wrong', 'missing', 'urgent', 'manager', 'escalat',
  '상담사', '상담원', '연결', '환불', '교환', '반품', '불만', '클레임', '담당자', '긴급',
  '파손', '오배송', '누락',
];

function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, li) => {
        if (line.match(/^[-•*]\s/)) {
          return (
            <div key={li} className="flex gap-2 pl-1">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>{renderInline(line.replace(/^[-•*]\s/, ''))}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={li} className="h-1" />;
        return <div key={li}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-200/60 text-gray-700 px-1 py-0.5 rounded text-[12px] font-mono">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AIChatbot({ isKorea = false }: { isKorea?: boolean }) {
  const { lang } = useI18n();
  const L = LABELS[lang] ?? LABELS['en'];
  const suggestions = lang === 'kr' ? SUGGESTED_KR : SUGGESTED_EN;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', skinType: '', country: '' });
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/chat/config')
      .then(async r => {
        // /api/chat/config now returns 503 when Supabase is unreachable
        // instead of silently defaulting to "chatbot enabled". Hide the
        // widget when the config can't be fetched so the operator notices
        // the outage instead of a half-broken chatbot.
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!data || data.error) {
          setIsEnabled(false);
          return;
        }
        const visible = isKorea ? (data.show_domestic ?? false) : (data.show_global ?? false);
        setIsEnabled(visible);
        const customGreeting = lang === 'kr' ? data.greeting_kr : data.greeting_en;
        if (customGreeting) {
          setMessages([{ id: 'greeting', role: 'assistant', content: customGreeting }]);
        } else {
          setMessages([{ id: 'greeting', role: 'assistant', content: L.greeting }]);
        }
      })
      .catch(() => {
        setIsEnabled(false);
      });
  }, [lang, L.greeting, isKorea]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-focus input when chat opens OR when typing finishes
  useEffect(() => {
    if (isOpen && !isTyping) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, isTyping]);

  // Check if user or bot response triggers escalation
  const checkEscalation = useCallback((text: string) => {
    const lower = text.toLowerCase();
    return ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Check if user is requesting escalation
    if (!contactSubmitted && checkEscalation(userText)) {
      setShowContactForm(true);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter(m => m.id !== 'greeting')
            .map(m => ({ role: m.role, content: m.content })),
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API error');

      const reply = data.reply;
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString() + '_r', role: 'assistant', content: reply },
      ]);

      // Also check if bot response suggests escalation
      if (!contactSubmitted && !showContactForm && checkEscalation(reply)) {
        setShowContactForm(true);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString() + '_e', role: 'assistant', content: L.error },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, lang, L.error, contactSubmitted, showContactForm, checkEscalation]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    sendMessage(input.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleContactSubmit = async () => {
    if (!contactForm.email.trim()) return;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);
        await sb.from('chatbot_leads').insert({
          name: contactForm.name || null,
          email: contactForm.email,
          skin_type: contactForm.skinType || null,
          country: contactForm.country || null,
        });
      }
    } catch { /* silently fail */ }
    setShowContactForm(false);
    setContactSubmitted(true);
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString() + '_ty', role: 'assistant', content: L.thanks },
    ]);
  };

  if (isEnabled === false || isEnabled === null) return null;

  return (
    <>
      {/* ── Floating icon button (bottom-right) ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-brand-notice-to to-brand-notice-from shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center transition-all duration-200"
          aria-label="Open AI Chatbot"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* ── Expanded: Chat panel (bottom-right) ── */}
      {isOpen && (
        <div className="fixed bottom-6 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[380px] max-h-[min(80vh,600px)] sm:max-h-[600px] flex flex-col bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] border border-gray-200/80 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-brand-notice-to to-brand-notice-from">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">KOKKOK {L.poweredBy}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-white/70">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0 max-h-[400px]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-notice-to to-brand-notice-from flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="relative group max-w-[80%]">
                  <div
                    className={`px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-ink text-white rounded-2xl rounded-br-md'
                        : 'bg-gray-50 text-gray-800 rounded-2xl rounded-bl-md border border-gray-100'
                    }`}
                  >
                    {msg.role === 'assistant' ? <RenderMarkdown text={msg.content} /> : msg.content}
                  </div>
                  {msg.role === 'assistant' && msg.id !== 'greeting' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      {copiedId === msg.id ? (
                        <><Check className="w-3 h-3" />{L.copied}</>
                      ) : (
                        <><Copy className="w-3 h-3" />Copy</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Contact form — only on escalation */}
            {showContactForm && !contactSubmitted && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-notice-to to-brand-notice-from flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
                  <Mail className="w-3 h-3 text-white" />
                </div>
                <div className="max-w-[80%] bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md p-4 space-y-2.5">
                  <p className="text-[13px] text-gray-700 font-medium">{L.emailPrompt}</p>
                  <input type="text" placeholder={L.namePlaceholder} value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#6b9fd4] bg-white" />
                  <input type="email" placeholder={L.emailPlaceholder + ' *'} value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#6b9fd4] bg-white" />
                  <input type="text" placeholder={L.skinTypePlaceholder} value={contactForm.skinType} onChange={e => setContactForm(p => ({ ...p, skinType: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#6b9fd4] bg-white" />
                  <input type="text" placeholder={L.countryPlaceholder} value={contactForm.country} onChange={e => setContactForm(p => ({ ...p, country: e.target.value }))} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#6b9fd4] bg-white" />
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleContactSubmit} disabled={!contactForm.email.trim()} className="flex-1 flex items-center justify-center gap-1.5 bg-brand-ink text-white text-xs font-semibold py-2 rounded-lg hover:bg-black transition disabled:opacity-40">
                      {L.submit} <ArrowRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => { setShowContactForm(false); setContactSubmitted(true); }} className="px-3 text-xs text-gray-400 hover:text-gray-600 transition">{L.skip}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-notice-to to-brand-notice-from flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Suggested questions — only at start */}
            {messages.length <= 1 && !isTyping && (
              <div className="pt-2">
                <p className="text-[11px] text-gray-400 font-medium mb-2.5 uppercase tracking-wider">{L.suggested}</p>
                <div className="space-y-2">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-[12px] text-gray-600 bg-white hover:bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-all flex items-center gap-2 group"
                    >
                      <Search className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                      <span className="line-clamp-1">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-[#6b9fd4] focus-within:bg-white transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={L.chatPlaceholder}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder:text-gray-400"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="w-8 h-8 rounded-lg bg-brand-ink flex items-center justify-center flex-shrink-0 hover:bg-black transition-colors disabled:opacity-20"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-300 text-center mt-1.5">Powered by KOKKOK Garden AI</p>
          </div>
        </div>
      )}
    </>
  );
}
