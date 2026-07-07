"use client";

import { use } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatComponent } from "@/components/chat/chat-component";
import { ThemeToggle } from "@/components/theme-toggle";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const resolvedParams = use(params);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 items-center border-b px-3">
        <SidebarTrigger />
        <div className="ml-2">
          <h1 className="text-base font-medium">Chat</h1>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatComponent chatId={resolvedParams.chatId} />
      </div>
    </div>
  );
}
