import { useState } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "motion/react";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "var(--gradient-light)", opacity: 0.5 }} />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-blob" style={{ backgroundColor: "var(--blob-1)" }} />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full blur-3xl animate-blob animation-delay-2000" style={{ backgroundColor: "var(--blob-2)" }} />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full blur-3xl animate-blob animation-delay-4000" style={{ backgroundColor: "var(--blob-3)" }} />
      </div>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(var(--dot-pattern) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 220, damping: 20 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
            className="inline-block mb-4"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mx-auto" style={{ background: "var(--gradient-logo)" }}>
              <span className="text-white text-2xl">✦</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-3xl bg-clip-text text-transparent font-(--font-quicksand)"
            style={{ backgroundImage: "var(--gradient-text)" }}
          >
            NanoNet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Microservice Monitoring Platform
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl rounded-2xl p-8" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)", boxShadow: "0 20px 40px var(--shadow-card)" }}>
            <div className="mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Welcome back</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="grid gap-2"
              >
                <Label htmlFor="email" className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@nanonet.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl transition-all"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                  required
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.38 }}
                className="grid gap-2"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground text-xs font-medium">Password</Label>
                  <Link to="/forgot-password" className="text-[10px] transition-colors" style={{ color: "var(--text-muted)" }}>
                    Şifremi Unuttum
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl pr-10 transition-all"
                    style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.46 }}
              >
                <Button
                  type="submit"
                  disabled={isLoggingIn || !email || !password}
                  className="w-full text-white rounded-xl h-10 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                  style={{ background: "var(--gradient-btn-primary)" }}
                >
                  {isLoggingIn ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Sign In
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-6 text-center"
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Don't have an account?{" "}
                <Link to="/register" className="font-medium transition-colors" style={{ color: "var(--text-link)" }}>
                  Register
                </Link>
              </p>
            </motion.div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-5"
        >
          <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>NanoNet v2.0 · Powered by AI</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
