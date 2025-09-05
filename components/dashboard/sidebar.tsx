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
import {
  Home,
  Clock,
  Calendar,
  Users,
  MapPin,
  QrCode,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Upload,
  Shield,
  UserCheck,
} from "lucide-react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

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
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    icon: Clock,
    roles: ["admin", "department_head", "staff"],
  },
  {
    title: "Schedule",
    href: "/dashboard/schedule",
    icon: Calendar,
    roles: ["admin", "department_head"],
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["admin", "department_head", "staff"],
  },
  {
    title: "Locations",
    href: "/dashboard/locations",
    icon: MapPin,
    roles: ["admin", "department_head"],
  },
  {
    title: "QR Events",
    href: "/dashboard/qr-events",
    icon: QrCode,
    roles: ["admin", "department_head"],
  },
  {
    title: "Staff Management",
    href: "/dashboard/staff",
    icon: Users,
    roles: ["admin", "department_head"],
  },
  {
    title: "User Approvals",
    href: "/dashboard/user-approvals",
    icon: UserCheck,
    roles: ["admin"],
  },
  {
    title: "Data Management",
    href: "/dashboard/data-management",
    icon: Upload,
    roles: ["admin"],
  },
  {
    title: "Audit Logs",
    href: "/dashboard/audit-logs",
    icon: Shield,
    roles: ["admin"],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["admin", "department_head", "staff"],
  },
]

export function Sidebar({ user, profile }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()

    try {
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
    router.push("/auth/login")
  }

  const filteredNavItems = navigationItems.filter((item) => item.roles.includes(profile?.role || "staff"))

  const userInitials = profile ? `${profile.first_name[0]}${profile.last_name[0]}` : "U"

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-background/95 backdrop-blur"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
            <Image src="/images/qcc-logo.png" alt="QCC Logo" width={40} height={40} className="rounded-full" />
            <div>
              <h2 className="font-semibold text-sidebar-foreground">QCC Attendance</h2>
              <p className="text-xs text-muted-foreground">Electronic System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.profile_image_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground">
                      {profile ? `${profile.first_name} ${profile.last_name}` : "Loading..."}
                    </p>
                    <p className="text-xs text-muted-foreground">{profile?.departments?.name || "No department"}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile">Profile Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Preferences</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </>
  )
}
