"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Users,
  Trophy,
  Star,
  Shield,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Hjem", icon: Home },
  { href: "/gruppespill", label: "Gruppespill", icon: Users },
  { href: "/sluttspill", label: "Sluttspill", icon: Trophy },
  { href: "/special-bets", label: "Special bets", icon: Star },
  { href: "/liga", label: "Liga", icon: Shield },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({
  children,
  displayName,
  isAdmin,
}: {
  children: React.ReactNode;
  displayName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const supabase = createClient();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4">
          <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <img className="size-5  brightness-0 invert" src="/trophy.svg" alt="Poeng" />
            </span>
            <span className="hidden sm:inline">VM 2026</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Bytt tema"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                  {displayName}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Logg ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav: horizontally scrollable row */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t px-3 py-1.5 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
