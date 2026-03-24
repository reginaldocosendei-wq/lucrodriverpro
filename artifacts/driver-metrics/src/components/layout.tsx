import { Link, useLocation } from "wouter";
import { Home, Car, Wallet, Target, BarChart2, LogOut, User as UserIcon } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0 md:pl-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass-panel border-b-0 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
            <Car size={20} className="fill-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none text-gradient">Lucro Driver</h1>
            {user && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserIcon size={12} /> {user.name.split(' ')[0]}
                </span>
                {user.plan === "pro" && (
                  <span className="text-[10px] font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-1.5 py-0.5 rounded-sm">
                    PRO
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2 text-muted-foreground hover:text-white transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) / Side Navigation (Desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 glass-panel border-t-0 md:border-r-0 md:top-0 md:w-24 md:flex-col md:justify-center md:pb-0 pb-safe">
        <div className="flex md:flex-col items-center justify-around md:justify-center md:gap-8 h-20 md:h-full px-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link key={item.path} href={item.path} className="relative w-full md:w-auto h-full flex items-center justify-center">
                <div className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300",
                  isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-white hover:scale-105"
                )}>
                  <div className="relative">
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    {item.isPro && user?.plan !== "pro" && (
                      <div className="absolute -top-1 -right-2 h-3 w-3 bg-yellow-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
                {isActive && (
                  <div className="absolute -bottom-2 md:bottom-auto md:-right-4 w-12 md:w-1 h-1 md:h-12 bg-primary rounded-full glow-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
