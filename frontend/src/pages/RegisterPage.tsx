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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7ff] via-[#f5f0ff] to-[#fdf2f8] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#c4b5fd]/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-[#39c5bb]/12 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#fda4af]/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(57, 197, 187, 0.06) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="inline-block"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#c4b5fd] to-[#93c5fd] rounded-2xl flex items-center justify-center shadow-lg shadow-[#c4b5fd]/20 mx-auto mb-4">
              <span className="text-white text-2xl">✦</span>
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent font-[var(--font-quicksand)]">
            NanoNet
          </h1>
          <p className="text-sm text-[#7c8db5] mt-1">Yeni hesap oluşturun</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border-[#c4b5fd]/15 rounded-2xl shadow-xl shadow-[#c4b5fd]/5 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#3b4563]">Kayıt Ol</h2>
            <p className="text-xs text-[#7c8db5] mt-1">Platformu kullanmaya başlayın</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-[#3b4563] text-xs">
                E-posta
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@nanonet.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#f5f8ff] border-[#c4b5fd]/15 text-[#3b4563] placeholder:text-[#b0bdd5] rounded-xl"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-[#3b4563] text-xs">
                Şifre
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#f5f8ff] border-[#c4b5fd]/15 text-[#3b4563] placeholder:text-[#b0bdd5] rounded-xl pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c8db5] hover:text-[#c4b5fd] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password" className="text-[#3b4563] text-xs">
                Şifre Tekrar
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`bg-[#f5f8ff] border-[#c4b5fd]/15 text-[#3b4563] placeholder:text-[#b0bdd5] rounded-xl ${
                  confirmPassword && password !== confirmPassword ? "border-[#fb7185]/50" : ""
                }`}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] text-[#fb7185]">Şifreler eşleşmiyor</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isRegistering || (!!confirmPassword && password !== confirmPassword)}
              className="w-full bg-linear-to-r from-[#c4b5fd] to-[#93c5fd] hover:from-[#a78bfa] hover:to-[#60a5fa] text-white rounded-xl h-10"
            >
              {isRegistering ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Kayıt yapılıyor...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Kayıt Ol
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#7c8db5]">
              Zaten hesabınız var mı?{" "}
              <Link to="/login" className="text-[#c4b5fd] hover:text-[#a78bfa] font-medium transition-colors">
                Giriş Yap
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
