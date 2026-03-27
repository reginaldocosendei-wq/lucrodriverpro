import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  show: boolean;
}

export function SplashScreen({ show }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
          style={{ background: "#0a0a0a", pointerEvents: "none" }}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(0,255,136,0.07) 0%, transparent 70%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-8"
          >
            <div className="w-28 h-28 rounded-[32px] overflow-hidden shadow-2xl border border-white/10"
              style={{ boxShadow: "0 0 60px rgba(0,255,136,0.18), 0 20px 40px rgba(0,0,0,0.6)" }}>
              <img
                src={`${import.meta.env.BASE_URL}icon.svg`}
                alt="Lucro Driver"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <div
              className="absolute -inset-6 pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(0,255,136,0.12) 0%, transparent 70%)",
              }}
            />
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <h1 className="text-4xl font-display font-extrabold tracking-tight text-white leading-none">
              Lucro{" "}
              <span style={{ color: "#00ff88" }}>Driver</span>
            </h1>
            <p className="mt-2.5 text-sm font-medium text-white/40 tracking-wide">
              Seu painel inteligente de ganhos
            </p>
          </motion.div>

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="absolute bottom-16 flex items-center gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-1.5 h-1.5 rounded-full"
                style={{ background: "#00ff88" }}
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
