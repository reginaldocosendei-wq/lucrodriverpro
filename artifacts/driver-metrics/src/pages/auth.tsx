import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Label, Card } from "@/components/ui";
import { Mail, Lock, User, Car } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha muito curta"),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, "Nome obrigatório"),
});

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const [errorMsg, setErrorMsg] = useState("");

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onLogin = loginForm.handleSubmit((data) => {
    setErrorMsg("");
    loginMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err: any) => {
        setErrorMsg(err?.response?.data?.error || "Erro ao fazer login");
      }
    });
  });

  const onRegister = registerForm.handleSubmit((data) => {
    setErrorMsg("");
    registerMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err: any) => {
        setErrorMsg(err?.response?.data?.error || "Erro ao criar conta");
      }
    });
  });

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Dark neon street background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-primary/20 rounded-3xl mx-auto mb-6 flex items-center justify-center border border-primary/30 glow-primary"
          >
            <Car size={40} className="text-primary fill-primary" />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl font-display font-extrabold text-white mb-2"
          >
            Lucro <span className="text-primary">Driver</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Seu painel inteligente de ganhos
          </motion.p>
        </div>

        <Card className="p-8 backdrop-blur-xl bg-card/80 border-white/10">
          <div className="flex bg-black/40 rounded-xl p-1 mb-8">
            <button
              onClick={() => { setIsLogin(true); setErrorMsg(""); }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-white'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setIsLogin(false); setErrorMsg(""); }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-white'}`}
            >
              Cadastrar
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={onLogin}
                className="space-y-5"
              >
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    icon={<Mail size={20} />} 
                    placeholder="seu@email.com" 
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-destructive text-xs mt-1">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input 
                    type="password" 
                    icon={<Lock size={20} />} 
                    placeholder="••••••" 
                    {...loginForm.register("password")}
                  />
                </div>
                <Button type="submit" className="w-full mt-4" size="lg" isLoading={loginMutation.isPending}>
                  Acessar Painel
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={onRegister}
                className="space-y-5"
              >
                <div>
                  <Label>Nome</Label>
                  <Input 
                    type="text" 
                    icon={<User size={20} />} 
                    placeholder="João Silva" 
                    {...registerForm.register("name")}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    icon={<Mail size={20} />} 
                    placeholder="seu@email.com" 
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input 
                    type="password" 
                    icon={<Lock size={20} />} 
                    placeholder="Mínimo 6 caracteres" 
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full mt-4" size="lg" isLoading={registerMutation.isPending}>
                  Criar Conta
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
