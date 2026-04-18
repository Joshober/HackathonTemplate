import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { chatMessages, aiSuggestions } from "../../data/mockData";
import { PageHeader } from "../common/PageHeader";

export function AIAssistant() {
  const [messages, setMessages] = useState(chatMessages);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages([
      ...messages,
      {
        id: messages.length + 1,
        type: "user",
        content: input,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          type: "assistant",
          content: "I'm analyzing your request. Let me find the best options for you based on company policy and your preferences.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-gray-50">
      {/* Header */}
      <PageHeader subtitle="Get smart travel recommendations" />

      {/* Quick Actions */}
      <div className="p-4 glass-panel border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          Quick Actions
        </div>
        <div className="grid grid-cols-2 gap-2">
          {aiSuggestions.slice(0, 4).map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="px-3 py-2 glass-card text-left text-sm text-gray-700 rounded-lg hover:glass-button transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === "user"
                  ? "glass-gradient-button text-white"
                  : "glass-card text-gray-800"
              }`}
            >
              {message.type === "assistant" && (
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-600">
                    AI Assistant
                  </span>
                </div>
              )}
              <p className="text-sm">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.type === "user" ? "text-white/80" : "text-gray-500"
                }`}
              >
                {message.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 glass-panel border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask me anything about travel..."
            className="flex-1 px-4 py-3 glass-card rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 placeholder-gray-500"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-3 glass-gradient-button text-white rounded-xl hover:scale-105 transition-all shine-overlay"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}