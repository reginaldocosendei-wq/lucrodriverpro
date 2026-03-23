import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { 
  Car, 
  MapPin, 
  Banknote, 
  Wrench, 
  Fuel, 
  Home as HomeIcon, 
  Target, 
  TrendingUp,
  Activity,
  ChevronRight
} from 'lucide-react';

export default function Home() {
  // State for Nova Corrida
  const [corridaValor, setCorridaValor] = useState('');
  const [corridaKm, setCorridaKm] = useState('');
  const [ganhoPorKm, setGanhoPorKm] = useState<number | null>(null);

  // State for Despesas
  const [combustivel, setCombustivel] = useState('');
  const [manutencao, setManutencao] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [totalDespesas, setTotalDespesas] = useState<number | null>(null);

  // State for Meta
  const [meta, setMeta] = useState('');
  const [ganhoAtual, setGanhoAtual] = useState('');
  const [metaResult, setMetaResult] = useState<{ falta: number, porDia: number } | null>(null);

  // Calculations
  const calcularCorrida = () => {
    const v = parseFloat(corridaValor);
    const k = parseFloat(corridaKm);
    if (v && k && k > 0) {
      setGanhoPorKm(v / k);
    } else {
      setGanhoPorKm(null);
    }
  };

  const calcularDespesas = () => {
    const c = parseFloat(combustivel) || 0;
    const m = parseFloat(manutencao) || 0;
    const a = parseFloat(aluguel) || 0;
    
    if (c || m || a) {
      setTotalDespesas(c + m + a);
    } else {
      setTotalDespesas(null);
    }
  };

  const calcularMeta = () => {
    const m = parseFloat(meta);
    const g = parseFloat(ganhoAtual);
    if (m && g !== isNaN(g as any)) {
      const falta = Math.max(0, m - g);
      setMetaResult({
        falta,
        porDia: falta / 30
      });
    } else {
      setMetaResult(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="min-h-screen w-full relative pb-20">
      {/* Background with overlay */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 mix-blend-screen"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/dashboard-bg.png)` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/80 via-background to-background" />

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12 flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_-5px_rgba(0,255,136,0.3)] border border-primary/30">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white font-display mb-3 tracking-tight">
            Driver<span className="text-primary">Metrics</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Seu painel inteligente para controle de ganhos, gastos e metas diárias.
          </p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Card: Nova Corrida */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-white">
                  <Car className="w-6 h-6 text-primary" />
                  Nova Corrida
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Valor da corrida (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<Banknote className="w-5 h-5" />}
                      value={corridaValor}
                      onChange={(e) => setCorridaValor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>KM rodado</Label>
                    <Input 
                      type="number" 
                      placeholder="0.0" 
                      icon={<MapPin className="w-5 h-5" />}
                      value={corridaKm}
                      onChange={(e) => setCorridaKm(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button onClick={calcularCorrida}>
                  Calcular Ganho
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>

                {ganhoPorKm !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between"
                  >
                    <span className="text-muted-foreground font-medium">Ganho por KM:</span>
                    <span className="text-2xl font-bold text-primary font-display">
                      {formatCurrency(ganhoPorKm)}
                    </span>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card: Despesas */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-white">
                  <Wrench className="w-6 h-6 text-primary" />
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Combustível</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<Fuel className="w-5 h-5" />}
                      value={combustivel}
                      onChange={(e) => setCombustivel(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Manutenção</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<Wrench className="w-5 h-5" />}
                      value={manutencao}
                      onChange={(e) => setManutencao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Aluguel</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<HomeIcon className="w-5 h-5" />}
                      value={aluguel}
                      onChange={(e) => setAluguel(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={calcularDespesas} className="bg-white text-black hover:bg-gray-200 shadow-none glow-none">
                  Somar Despesas
                </Button>

                {totalDespesas !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between"
                  >
                    <span className="text-muted-foreground font-medium">Total de despesas:</span>
                    <span className="text-2xl font-bold text-destructive font-display">
                      {formatCurrency(totalDespesas)}
                    </span>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card: Meta */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-white">
                  <Target className="w-6 h-6 text-primary" />
                  Meta Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Meta mensal (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<Target className="w-5 h-5" />}
                      value={meta}
                      onChange={(e) => setMeta(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ganho atual (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      icon={<TrendingUp className="w-5 h-5" />}
                      value={ganhoAtual}
                      onChange={(e) => setGanhoAtual(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={calcularMeta} className="bg-accent text-accent-foreground">
                  Analisar Meta
                  <TrendingUp className="w-5 h-5 ml-2" />
                </Button>

                {metaResult !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-center">
                      <span className="text-muted-foreground text-sm font-medium mb-1">Falta para atingir:</span>
                      <span className="text-2xl font-bold text-white font-display">
                        {formatCurrency(metaResult.falta)}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-center">
                      <span className="text-primary/80 text-sm font-medium mb-1">Necessário por dia:</span>
                      <span className="text-2xl font-bold text-primary font-display">
                        {formatCurrency(metaResult.porDia)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
