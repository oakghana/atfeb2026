"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { clearAppCache, clearCacheAndReload } from "@/lib/cache-manager"
import {
  Home,
  Clock,
  FileText,
  BarChart3,
  MapPin,
  QrCode,
  Users,
  UserCheck,
  Upload,
  Shield,
  Settings,
  X,
  Menu,
  ChevronRight,
  User,
  LogOut,
  HelpCircle,
  RefreshCw,
} from "lucide-react"
import Image from "next/image"

interface SidebarProps {
  user: {
    id: string
    email: string
  }
  profile: {
    first_name: string
    last_name: string
    employee_id: string
    role: string
    departments?: {
      name: string
      code: string
    }
  } | null
}

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: ["admin", "department_head", "staff"],
    category: "main",
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    icon: Clock,
    roles: ["admin", "it-admin", "department_head", "staff"],
    category: "main",
  },
  {
    title: "Excuse Duty",
    href: "/dashboard/excuse-duty",
    icon: FileText,
    roles: ["admin", "it-admin", "department_head", "staff"],
    category: "main",
  },
  {
    title: "Excuse Duty Review",
    href: "/dashboard/excuse-duty-review",
    icon: FileText,
    roles: ["admin", "department_head"],
    category: "admin",
  },
  {
    title: "Schedule",
    href: "/dashboard/schedule",
    icon: Clock,
    roles: ["admin", "department_head"],
    category: "main",
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["admin", "it-admin", "department_head", "staff"],
    category: "main",
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircle,
    roles: ["admin", "department_head", "staff"],
    category: "main",
  },
  {
    title: "Locations",
    href: "/dashboard/locations",
    icon: MapPin,
    roles: ["admin"],
    category: "admin",
  },
  {
    title: "QR Events",
    href: "/dashboard/qr-events",
    icon: QrCode,
    roles: ["admin", "department_head"],
    category: "admin",
  },
  {
    title: "Staff Management",
    href: "/dashboard/staff",
    icon: Users,
    roles: ["admin", "it-admin"],
    category: "admin",
  },
  {
    title: "Staff Activation",
    href: "/dashboard/staff-activation",
    icon: UserCheck,
    roles: ["admin"],
    category: "admin",
  },
  {
    title: "Data Management",
    href: "/dashboard/data-management",
    icon: Upload,
    roles: ["admin"],
    category: "admin",
  },
  {
    title: "Audit Logs",
    href: "/dashboard/audit-logs",
    icon: Shield,
    roles: ["admin"],
    category: "admin",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["admin", "department_head", "staff"],
    category: "settings",
  },
]

export function Sidebar({ user, profile }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()

    try {
      await clearAppCache()

      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    } catch (error) {
      console.error("Failed to log logout action:", error)
    }

    await supabase.auth.signOut()

    window.location.href = "/auth/login"
  }

  const handleClearCache = async () => {
    setIsClearingCache(true)
    try {
      await clearCacheAndReload()
    } catch (error) {
      console.error("[v0] Failed to clear cache:", error)
      setIsClearingCache(false)
    }
  }

  const isHRDepartmentHead =
    profile?.role === "department_head" &&
    (profile?.departments?.name?.toLowerCase().includes("hr") ||
      profile?.departments?.name?.toLowerCase().includes("human resource") ||
      profile?.departments?.code?.toLowerCase() === "hr")

  const shouldShowHRPortal = profile?.role === "admin" || isHRDepartmentHead

  const allNavigationItems = shouldShowHRPortal
    ? [
        ...navigationItems,
        {
          title: "HR Excuse Duty Portal",
          href: "/dashboard/hr-excuse-duty",
          icon: UserCheck,
          roles: ["admin", "department_head"],
          category: "admin" as const,
        },
      ]
    : navigationItems

  const filteredNavItems = allNavigationItems.filter((item) => item.roles.includes(profile?.role || "staff"))

  const mainItems = filteredNavItems.filter((item) => item.category === "main")
  const adminItems = filteredNavItems.filter((item) => item.category === "admin")
  const settingsItems = filteredNavItems.filter((item) => item.category === "settings")

  const userInitials = profile ? `${profile.first_name[0]}${profile.last_name[0]}` : "U"

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="h-12 w-12 bg-background/95 backdrop-blur-xl shadow-xl border-border/50 hover:bg-background hover:shadow-2xl transition-all duration-300 touch-manipulation"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-sidebar to-sidebar/95 backdrop-blur-xl border-r border-sidebar-border/50 shadow-2xl transform transition-all duration-300 ease-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="relative p-2 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
              <Image src="/images/qcc-logo.png" alt="QCC Logo" width={36} height={36} className="rounded-lg" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div>
              <h2 className="font-bold text-sidebar-foreground text-lg tracking-tight">QCC Attendance</h2>
              <p className="text-xs text-muted-foreground font-medium">Electronic System</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
            <div className="space-y-2">
              <div className="px-3 mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main</h3>
              </div>
              {mainItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden touch-manipulation min-h-[48px]",
                      isActive
                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                        : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-muted hover:to-muted/50 hover:text-foreground hover:shadow-md hover:scale-[1.01]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 transition-transform duration-300",
                        isActive ? "scale-110" : "group-hover:scale-105",
                      )}
                    />
                    <span className="flex-1">{item.title}</span>
                    {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                    )}
                  </Link>
                )
              })}
            </div>

            {adminItems.length > 0 && (
              <div className="space-y-2">
                <div className="px-3 mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Administration
                  </h3>
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
                  >
                    Admin
                  </Badge>
                </div>
                {adminItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden touch-manipulation min-h-[48px]",
                        isActive
                          ? "bg-gradient-to-r from-accent to-accent/90 text-accent-foreground shadow-lg shadow-accent/25 scale-[1.02]"
                          : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-muted hover:to-muted/50 hover:text-foreground hover:shadow-md hover:scale-[1.01]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0 transition-transform duration-300",
                          isActive ? "scale-110" : "group-hover:scale-105",
                        )}
                      />
                      <span className="flex-1">{item.title}</span>
                      {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="space-y-2">
              <div className="px-3 mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</h3>
              </div>
              {settingsItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden touch-manipulation min-h-[48px]",
                      isActive
                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                        : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-muted hover:to-muted/50 hover:text-foreground hover:shadow-md hover:scale-[1.01]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 transition-transform duration-300",
                        isActive ? "scale-110" : "group-hover:scale-105",
                      )}
                    />
                    <span className="flex-1">{item.title}</span>
                    {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                    )}
                  </Link>
                )
              })}
              <button
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="group flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden touch-manipulation min-h-[48px] w-full text-sidebar-foreground hover:bg-gradient-to-r hover:from-muted hover:to-muted/50 hover:text-foreground hover:shadow-md hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-105",
                    isClearingCache && "animate-spin",
                  )}
                />
                <span className="flex-1 text-left">{isClearingCache ? "Clearing..." : "Clear Cache"}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="group flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden touch-manipulation min-h-[48px] w-full text-destructive hover:bg-gradient-to-r hover:from-destructive/10 hover:to-destructive/5 hover:text-destructive hover:shadow-md hover:scale-[1.01]"
              >
                <LogOut className="h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-105" />
                <span className="flex-1 text-left">Sign Out</span>
              </button>
            </div>
          </nav>

          <div className="p-4 border-t border-sidebar-border/50 bg-gradient-to-r from-muted/20 to-transparent">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto p-4 hover:bg-gradient-to-r hover:from-muted hover:to-muted/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] touch-manipulation min-h-[56px]"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
                      <AvatarImage src={profile?.profile_image_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-sidebar shadow-sm" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-sidebar-foreground">
                      {profile ? `${profile.first_name} ${profile.last_name}` : "Loading..."}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {profile?.departments?.name || "No department"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 shadow-xl border-border/50 bg-background/95 backdrop-blur-xl"
              >
                <DropdownMenuLabel className="font-semibold">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]"
                  >
                    <User className="h-4 w-4" />
                    <span className="font-medium">Profile Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="font-medium">Preferences</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-all duration-300 touch-manipulation"
          onClick={() => setIsMobileMenuOpen(false)}
          onTouchStart={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
