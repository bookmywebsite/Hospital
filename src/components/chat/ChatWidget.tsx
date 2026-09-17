'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  quickActions?: { id: string; label: string; action: string }[];
}

type OnboardingStep = 'name' | 'phone' | 'email' | 'done';

interface ChatWidgetProps {
  agentId:        string;
  primaryColor?:  string;
  welcomeMessage?: string;
  agentName?:     string;
  channel?:       'website' | 'whatsapp';
}

export function ChatWidget({
  agentId,
  primaryColor  = '#4F46E5',
  welcomeMessage = "Hi! How can I help you today?",
  agentName     = 'AI Assistant',
  channel       = 'website',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id:      'welcome',
      role:    'assistant',
      content: welcomeMessage,
    },
    {
      id:      'onboarding_name_prompt',
      role:    'assistant',
      content: 'Please share your full name so I can assist you better.',
    },
  ]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [fullName, setFullName] = useState('');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('name');
  const [messageCount, setMessageCount] = useState(0);
  const [exportReady, setExportReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    const messageText = overrideMessage ?? input.trim();
    if (!messageText || isLoading) return;

    // Add user message to UI immediately
    const userMsg: Message = {
      id:      Date.now().toString(),
      role:    'user',
      content: messageText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setMessageCount((c) => c + 1);

    // Mandatory onboarding: name -> mobile -> email (no skip)
    if (onboardingStep !== 'done') {
      const nextAssistant: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      if (onboardingStep === 'name') {
        const n = messageText.trim();
        if (n.length < 2) {
          nextAssistant.content = 'Please share your full name so I can proceed.';
        } else {
          setFullName(n);
          setOnboardingStep('phone');
          nextAssistant.content = `Thanks ${n}. Please share your mobile number first.`;
        }
        setMessages((prev) => [...prev, nextAssistant]);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      if (onboardingStep === 'phone') {
        const digits = messageText.replace(/\D/g, '');
        if (digits.length < 10) {
          nextAssistant.content = 'Please enter a valid mobile number (minimum 10 digits).';
        } else {
          const normalized = digits.length === 10 ? `+91${digits}` : `+${digits}`;
          setPhone(normalized);
          setOnboardingStep('email');
          nextAssistant.content = 'Great. Now please share your email address.';
        }
        setMessages((prev) => [...prev, nextAssistant]);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      if (onboardingStep === 'email') {
        const e = messageText.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          nextAssistant.content = 'Please enter a valid email address.';
        } else {
          setEmail(e);
          setOnboardingStep('done');
          nextAssistant.content = 'Perfect. Contact details saved. How can I help you today?';
        }
        setMessages((prev) => [...prev, nextAssistant]);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          message:   messageText,
          sessionId: sessionId || undefined,
          email:     email || undefined,
          phone:     phone || undefined,
          fullName:  fullName || undefined,
          channel:   channel,
        }),
      });

      const data = await res.json();

      // Store sessionId for conversation continuity
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMsg: Message = {
        id:           (Date.now() + 1).toString(),
        role:         'assistant',
        content:      data.message ?? "I'm here to help!",
        quickActions: data.quickActions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => inputRef.current?.focus(), 50);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id:      (Date.now() + 1).toString(),
          role:    'assistant',
          content: 'Sorry, I had trouble connecting. Please try again.',
        },
      ]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, agentId, sessionId, email, phone, fullName, channel, onboardingStep]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportConversation = async (format: 'pdf' | 'excel') => {
    if (!sessionId) return;
    try {
      const res = await fetch('/api/conversations/export-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: sessionId,
          format,
          channel,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        a.click();
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleQuickAction = (qa: { id: string; label: string; action: string }) => {
    if (qa.action === 'emergency') {
      if (typeof window !== 'undefined') window.location.href = 'tel:108';
      return;
    }

    if (qa.action === 'escalate') {
      const receptionistPhone = (process.env.NEXT_PUBLIC_HOSPITAL_RECEPTION_PHONE || process.env.NEXT_PUBLIC_HOSPITAL_PHONE || '').trim();
      const msg: Message = {
        id: `${Date.now()}_handoff`,
        role: 'assistant',
        content: receptionistPhone
          ? `Connecting you to our receptionist now. You can call directly on ${receptionistPhone}.`
          : 'Connecting you to our receptionist now. Please use the hospital reception number shown on website header/footer.',
      };
      setMessages((prev) => [...prev, msg]);
      if (receptionistPhone && typeof window !== 'undefined') window.location.href = `tel:${receptionistPhone}`;
      return;
    }

    sendMessage(qa.label);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[360px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ height: '520px' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{agentName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-xs text-white/80">Online · Powered by Fuelo Tehnologies</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === 'user'
                        ? 'bg-gray-300'
                        : 'text-white'
                    }`}
                    style={
                      msg.role === 'assistant'
                        ? { backgroundColor: primaryColor }
                        : {}
                    }
                  >
                    {msg.role === 'user'
                      ? <User className="h-4 w-4 text-gray-600" />
                      : <Bot  className="h-4 w-4 text-white" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className="max-w-[78%] space-y-1">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                      }`}
                      style={
                        msg.role === 'user'
                          ? { backgroundColor: primaryColor }
                          : {}
                      }
                    >
                      {msg.content}
                    </div>

                    {/* Quick action buttons */}
                    {msg.quickActions && msg.quickActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {msg.quickActions.map((qa) => (
                          <button
                            key={qa.id}
                            className="text-xs rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
                            onClick={() => handleQuickAction(qa)}
                          >
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-end gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 shadow-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Export prompt when contact collected */}
            {exportReady && onboardingStep === 'done' && (
              <div className="shrink-0 border-t bg-green-50 px-4 py-2">
                <p className="text-xs text-green-700 font-medium mb-2">
                  ✅ Contact saved! Export this conversation:
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => exportConversation('pdf')}
                    className="flex-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => exportConversation('excel')}
                    className="flex-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    📊 Excel
                  </button>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="shrink-0 border-t bg-white px-3 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:opacity-40 hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send    className="h-4 w-4" />
                  }
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-gray-400">Powered by Fuelo Technologies</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg hover:shadow-xl transition-shadow"
        style={{ backgroundColor: primaryColor }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquare className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}