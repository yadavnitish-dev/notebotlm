"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/layout/brand-logo";

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
}

export function AppHeader({
  backHref = "/dashboard",
  backLabel = "Dashboard",
}: AppHeaderProps) {
  const router = useRouter();

  const handleSignOut = () => {
    void signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <header className="glass-header sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 shrink-0 gap-1.5 px-2 text-xs sm:px-2.5"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Button>

          <div className="bg-border hidden h-4 w-px sm:block" />

          <BrandLogo size="sm" className="min-w-0" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 px-2.5 text-xs"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
