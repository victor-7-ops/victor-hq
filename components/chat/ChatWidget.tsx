'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_SUGGESTIONS = [
  "What's my cost today?",
  'Any cron failures?',
  'Gateway status?',
];

const MAX_HISTORY = 10;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMessage: Message = { role: 'user', content: trimmed };
      const updatedMessages = [...messages, userMessage].slice(-MAX_HISTORY);
      setMessages(updatedMessages);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: trimmed,
            history: updatedMessages.slice(0, -1),
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.answer ?? data.message ?? 'No response received.',
        };
        setMessages((prev) => [...prev, assistantMessage].slice(-MAX_HISTORY));
      } catch {
        const errorMessage: Message = {
          role: 'assistant',
          content:
            'Chat not available \u2014 configure gateway connection.',
        };
        setMessages((prev) => [...prev, errorMessage].slice(-MAX_HISTORY));
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px] h-[500px] rounded-xl border border-border bg-surface shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">
                Mission Control Chat
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MessageSquare className="h-8 w-8 text-text-muted" />
                <p className="text-xs text-text-muted text-center">
                  Ask anything about your infrastructure.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-background text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  msg.role === 'user'
                    ? 'ml-auto max-w-[80%] rounded-lg bg-accent/20 px-3 py-2 text-sm text-text-primary'
                    : 'mr-auto max-w-[80%] rounded-lg bg-background px-3 py-2 text-sm text-text-secondary',
                )}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className="mr-auto max-w-[80%] rounded-lg bg-background px-3 py-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-3 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className={cn(
                'h-9 w-9 rounded-lg bg-accent flex items-center justify-center transition-opacity',
                loading || !input.trim()
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:opacity-90',
              )}
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-accent shadow-lg flex items-center justify-center transition-transform hover:scale-105',
          open && 'rotate-0',
        )}
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageSquare className="h-5 w-5 text-white" />
        )}
      </button>
    </>
  );
}
