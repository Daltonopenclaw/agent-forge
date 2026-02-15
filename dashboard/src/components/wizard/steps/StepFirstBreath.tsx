"use client";

import { useEffect, useState, useRef } from "react";
import { useWizard } from "../WizardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

export function StepFirstBreath() {
  const { data } = useWizard();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // First Breath - agent's initial message
  useEffect(() => {
    const firstBreath = async () => {
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 1500));
      
      const greeting: Message = {
        id: "1",
        role: "assistant",
        content: `Hey! I'm ${data.name}, and I'm excited to start working with you. 👋\n\nBefore we dive in, I'd love to learn a few things so I can be more helpful:\n\n• What should I call you?\n• What timezone are you in?\n• Any topics you'd like me to focus on?`,
        timestamp: new Date(),
      };
      
      setMessages([greeting]);
      setIsTyping(false);
    };

    firstBreath();
  }, [data.name]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // TODO: Replace with actual API call to Gateway
    // Simulate agent response
    await new Promise((r) => setTimeout(r, 2000));

    const agentResponse: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: messages.length === 1 
        ? `Great to meet you! I've saved that to my memory — I'll remember this across our conversations. 📝\n\nI'm here to help with whatever you need. What would you like to work on first?`
        : `Got it! Let me help you with that...`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, agentResponse]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
          {data.avatar}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{data.name}</h2>
          <p className="text-slate-400 text-sm">Online</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" className="border-slate-700 text-slate-300">
            Settings
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{data.avatar}</span>
                  <span className="font-medium text-sm">{data.name}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{data.avatar}</span>
                <span className="text-slate-400 animate-pulse">typing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 pt-4">
        <div className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="bg-slate-800 border-slate-700 text-white"
            disabled={isTyping}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
            Send
          </Button>
        </div>
        <p className="text-slate-500 text-xs mt-2 text-center">
          Press Enter to send • {data.name} remembers your conversations
        </p>
      </div>
    </div>
  );
}
