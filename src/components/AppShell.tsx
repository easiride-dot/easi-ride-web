import { Outlet, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { Home, CalendarClock, User, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/request", icon: CalendarClock, label: "Book" },
  { to: "/account", icon: User, label: "Account" },
];

export const AppShell = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Logo />
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>
      <main className="container max-w-2xl py-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline/60 bg-background/90 backdrop-blur-xl">
        <div className="container max-w-2xl">
          <ul className="flex items-center justify-around py-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-lg px-5 py-2 text-xs transition-colors ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};
