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
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  Users,
  Trophy,
  Star,
  Shield,
  BarChart3,
  Moon,
  Sun,
  LogOut,
  MoreHorizontal,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Hjem", short: "Hjem", icon: Home },
  { href: "/sluttspill", label: "Sluttspill", short: "Sluttspill", icon: Trophy },
  { href: "/liga", label: "Liga", short: "Liga", icon: Shield },
  { href: "/special-bets", label: "Special bets", short: "Spesial", icon: Star },
  { href: "/statistikk", label: "Data Hub", short: "Data Hub", icon: BarChart3 },
  { href: "/gruppespill", label: "Gruppespill", short: "Grupper", icon: Users },
];

// Mobile bottom bar: first four are tabs, the rest live in a "Mer" sheet.
const PRIMARY_NAV = NAV.slice(0, 4);
const MORE_NAV = NAV.slice(4);

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

  const moreActive = MORE_NAV.some(({ href }) => isActive(href));

  async function signOut() {
    // scope: "local" signs out only this device. The default ("global")
    // revokes every session on every device for the account.
    await supabase.auth.signOut({ scope: "local" });
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
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
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
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:py-6">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="mx-auto flex max-w-7xl items-stretch">
          {PRIMARY_NAV.map(({ href, short, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
                )}
                <Icon className="size-5" />
                <span className="leading-none">{short}</span>
              </Link>
            );
          })}

          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem] font-medium transition-colors",
                    moreActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
              }
            >
              {moreActive && (
                <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
              )}
              <MoreHorizontal className="size-5" />
              <span className="leading-none">Mer</span>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Mer</SheetTitle>
              </SheetHeader>
              <div className="grid gap-1 pb-2">
                {MORE_NAV.map(({ href, label, icon: Icon }) => (
                  <SheetClose
                    key={href}
                    render={
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                          isActive(href)
                            ? "bg-secondary text-foreground"
                            : "hover:bg-secondary/60",
                        )}
                      >
                        <Icon className="size-5" />
                        {label}
                      </Link>
                    }
                  />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
