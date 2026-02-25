import { useState } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "motion/react";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { register, isRegistering } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    register({ email, password });
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"][passwordStrength];
  const strengthColor = ["", "#fb7185", "#fbbf24", "#34d399"][passwordStrength];
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "var(--gradient-light)", opacity: 0.5 }} />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FED7FF]/35 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-[#D0FAFF]/35 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#FED7FF]/25 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: `radial-gradient(rgba(0,180,216,0.07) 1px, transparent 1px)`, backgroundSize: "32px 32px" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 220, damping: 20 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: 10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
            className="inline-block mb-4"
          >
            <div className="w-16 h-16 bg-linear-to-br from-[#a78bfa] to-[#00b4d8] rounded-2xl flex items-center justify-center shadow-lg shadow-[#a78bfa]/25 mx-auto">
              <span className="text-white text-2xl">✦</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-3xl bg-linear-to-r from-[#00b4d8] via-[#a78bfa] to-[#f0abfc] bg-clip-text text-transparent font-(--font-quicksand)"
          >
            NanoNet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-[#7c8db5] mt-1"
          >
            Create your account
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/80 backdrop-blur-xl border-[#a78bfa]/15 rounded-2xl shadow-2xl shadow-[#a78bfa]/8 p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#3b4563]">Get started</h2>
              <p className="text-xs text-[#7c8db5] mt-0.5">Fill in the details below</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="grid gap-2">
                <Label htmlFor="email" className="text-[#3b4563] text-xs font-medium">Email</Label>
                <Input
                  id="email" type="email" placeholder="you@nanonet.dev"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#f0fbff] border-[#00b4d8]/20 text-foreground placeholder:text-[#b0bdd5] rounded-xl focus:border-[#00b4d8]/50 focus:ring-2 focus:ring-[#00b4d8]/10 transition-all"
                  required
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.38 }} className="grid gap-2">
                <Label htmlFor="password" className="text-[#3b4563] text-xs font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password" type={showPassword ? "text" : "password"} placeholder="Min. 6 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#f0fbff] border-[#a78bfa]/20 text-foreground placeholder:text-[#b0bdd5] rounded-xl pr-10 focus:border-[#a78bfa]/50 focus:ring-2 focus:ring-[#a78bfa]/10 transition-all"
                    required minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b0bdd5] hover:text-[#a78bfa] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map((level) => (
                        <div key={level} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: passwordStrength >= level ? strengthColor : "#e2e8f0" }} />
                      ))}
                    </div>
                    <span className="text-[10px] transition-colors" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.46 }} className="grid gap-2">
                <Label htmlFor="confirm-password" className="text-[#3b4563] text-xs font-medium">Confirm Password</Label>
                <Input
                  id="confirm-password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`bg-[#f0fbff] text-foreground placeholder:text-[#b0bdd5] rounded-xl transition-all ${
                    passwordMismatch ? "border-[#fb7185]/60 focus:ring-[#fb7185]/10"
                    : passwordsMatch ? "border-[#34d399]/40 focus:ring-[#34d399]/10"
                    : "border-[#a78bfa]/20 focus:ring-[#a78bfa]/10"
                  } focus:ring-2`}
                  required
                />
                {passwordMismatch && <p className="text-[10px] text-[#fb7185]">Passwords don't match</p>}
                {passwordsMatch && <p className="text-[10px] text-[#059669]">Passwords match ✓</p>}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
                <Button
                  type="submit"
                  disabled={isRegistering || passwordMismatch || !email || !password || !confirmPassword}
                  className="w-full bg-linear-to-r from-[#a78bfa] to-[#00b4d8] hover:from-[#7c3aed] hover:to-[#0096b4] text-white rounded-xl h-10 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                >
                  {isRegistering ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Create Account
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }} className="mt-6 text-center">
              <p className="text-xs text-[#7c8db5]">
                Already have an account?{" "}
                <Link to="/login" className="text-[#a78bfa] hover:text-[#7c3aed] font-medium transition-colors">
                  Sign In
                </Link>
              </p>
            </motion.div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.68 }} className="text-center mt-5">
          <p className="text-[10px] text-[#b0bdd5]">NanoNet v2.0 · Powered by AI</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
