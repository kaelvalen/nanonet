import { useState } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "motion/react";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { authApi } from "@/api/auth";
import { toast } from "sonner";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error("İşlem gerçekleştirilemedi, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "var(--gradient-light)", opacity: 0.5 }} />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#D0FAFF]/40 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-[#FED7FF]/35 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#D0FAFF]/30 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(0, 180, 216, 0.07) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 220, damping: 20 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
            className="inline-block mb-4"
          >
            <div className="w-16 h-16 bg-linear-to-br from-[#00b4d8] to-[#a78bfa] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00b4d8]/25 mx-auto">
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
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-xl border-[#00b4d8]/15 rounded-2xl shadow-2xl shadow-[#00b4d8]/8 p-8">
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="flex justify-center mb-4">
                  <CheckCircle className="w-12 h-12 text-[#34d399]" />
                </div>
                <h2 className="text-base font-semibold text-[#3b4563] mb-2">Kontrol edin</h2>
                <p className="text-xs text-[#7c8db5] leading-relaxed">
                  Eğer <span className="font-medium text-[#3b4563]">{email}</span> adresi kayıtlıysa
                  şifre sıfırlama bağlantısı gönderildi.
                </p>
                <p className="text-xs text-[#b0bdd5] mt-3">Bağlantı 1 saat geçerlidir.</p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-xs text-[#00b4d8] hover:text-[#0096b4] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Giriş sayfasına dön
                </Link>
              </motion.div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-[#3b4563]">Şifremi Unuttum</h2>
                  <p className="text-xs text-[#7c8db5] mt-0.5">
                    Email adresinizi girin, sıfırlama bağlantısı gönderelim.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-[#3b4563] text-xs font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0bdd5]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ornek@nanonet.dev"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-[#f0fbff] border-[#00b4d8]/20 text-foreground placeholder:text-[#b0bdd5] rounded-xl pl-9 focus:border-[#00b4d8]/50 focus:ring-2 focus:ring-[#00b4d8]/10 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full bg-linear-to-r from-[#00b4d8] to-[#a78bfa] hover:from-[#0096b4] hover:to-[#7c3aed] text-white rounded-xl h-10 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gönderiliyor...
                      </div>
                    ) : (
                      "Sıfırlama Bağlantısı Gönder"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-[#7c8db5] hover:text-[#00b4d8] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Giriş sayfasına dön
                  </Link>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
