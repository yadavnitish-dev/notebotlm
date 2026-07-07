"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatComponent } from "@/components/chat/chat-component";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2 } from "lucide-react";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="border-border bg-card flex h-12 items-center border-b px-3">
        <SidebarTrigger className="cursor-pointer" />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        <ChatComponent initialDocId={docId ?? undefined} />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex h-screen items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
