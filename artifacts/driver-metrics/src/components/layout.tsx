import { Link, useLocation } from "wouter";
import { Home, Car, Wallet, Target, BarChart2, LogOut } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.reload();
      }
    });
  };

  const navItems = [
    { path: "/", icon: Home, label: "Início" },
    { path: "/rides", icon: Car, label: "Corridas" },
    { path: "/costs", icon: Wallet, label: "Custos" },
    { path: "/goals", icon: Target, label: "Metas" },
    { path: "/reports", icon: BarChart2, label: "Relatórios", isPro: true },
  ];

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

  const currentPage = navItems.find(i => i.path === location);
  const pageTitle = currentPage?.label || "Lucro Driver";

  const getGreetingName = () => {
    return user?.name?.split(' ')[0] || "";
  };

  const activeIndex = navItems.findIndex(i => i.path === location);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0 md:pl-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-primary/20 px-4 py-4 flex items-center justify-between shadow-[0_4px_30px_rgba(0,255,136,0.05)]">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl leading-none text-white tracking-tight">
              {pageTitle}
            </h1>
            {user && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-medium text-muted-foreground">
                  {greeting}, <span className="text-foreground">{getGreetingName()}</span>
                </span>
                {user.plan === "pro" && (
                  <span className="text-[10px] font-extrabold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-2 py-0.5 rounded-sm shadow-[0_0_10px_rgba(255,215,0,0.3)] tracking-wider">
                    ✦ PRO
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2.5 rounded-full text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) / Side Navigation (Desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 glass-panel border-t border-white/10 md:border-t-0 md:border-r md:top-0 md:w-24 md:flex-col md:justify-center md:pb-0 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex md:flex-col items-center justify-between md:justify-center md:gap-10 h-20 md:h-full px-4 relative max-w-md mx-auto md:max-w-none">
          {navItems.map((item, index) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link key={item.path} href={item.path} className="relative flex-1 md:w-full h-full md:h-16 flex items-center justify-center z-10 group">
                <div className={cn(
                  "flex flex-col items-center gap-1.5 transition-all duration-300",
                  isActive ? "text-primary -translate-y-1" : "text-muted-foreground group-hover:text-white group-hover:-translate-y-0.5"
                )}>
                  <div className="relative">
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]" : ""} />
                    {item.isPro && user?.plan !== "pro" && (
                      <div className="absolute -top-1.5 -right-2 h-3.5 w-3.5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-background shadow-[0_0_5px_rgba(255,215,0,0.5)]" />
                    )}
                  </div>
                  <span className={cn("text-[10px] font-bold tracking-wide transition-all duration-300", isActive ? "opacity-100" : "opacity-0 md:opacity-70 group-hover:opacity-100")}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
          
          {/* Animated Pill Background for Mobile */}
          {activeIndex !== -1 && (
            <div 
              className="absolute md:hidden top-1/2 -translate-y-1/2 h-14 bg-white/5 rounded-2xl transition-all duration-500 ease-out z-0 pointer-events-none"
              style={{ 
                width: `calc(100% / ${navItems.length} - 8px)`,
                left: `calc(${(activeIndex * 100) / navItems.length}% + 4px + 16px * ${activeIndex / navItems.length})`, 
                // Adding a bit of logic for px padding, simplified:
                transform: `translateX(calc(${activeIndex * 100}% + ${16 * activeIndex}px))` // Adjust for padding if needed, but a simpler flex-based approach using styled width is easier
              }}
            />
          )}
          {/* A simpler sliding pill implementation based on percentage */}
          {activeIndex !== -1 && (
             <div className="absolute md:hidden top-2 bottom-2 left-4 right-4 z-0 pointer-events-none">
               <div className="relative w-full h-full">
                 <div 
                   className="absolute h-full bg-white/5 rounded-2xl transition-all duration-300 ease-out border border-white/5"
                   style={{
                     width: `${100 / navItems.length}%`,
                     transform: `translateX(${activeIndex * 100}%)`
                   }}
                 />
               </div>
             </div>
          )}
        </div>
      </nav>
    </div>
  );
}