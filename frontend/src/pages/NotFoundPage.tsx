import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

export function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: "var(--gradient-bg)" }}>
            {/* Ambient blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ backgroundColor: "var(--color-pink-subtle)" }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative backdrop-blur-xl rounded-3xl shadow-lg p-12 max-w-lg w-full text-center"
                style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}
            >
                {/* 404 Big Number */}
                <motion.h1
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-8xl font-black bg-clip-text text-transparent mb-2"
                    style={{ backgroundImage: "var(--gradient-heading)" }}
                >
                    404
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--color-lavender-subtle)" }}>
                        <Search className="w-8 h-8 opacity-50" style={{ color: "var(--color-lavender)" }} />
                    </div>

                    <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
                        Sayfa Bulunamadı
                    </h2>
                    <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
                    </p>

                    <div className="flex gap-3 justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(-1)}
                            className="rounded-xl text-xs h-9 px-4"
                            style={{ borderColor: "var(--color-teal-border)", color: "var(--text-muted)" }}
                        >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Geri Dön
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate("/", { replace: true })}
                            className="text-white rounded-xl text-xs h-9 px-4 border-0 hover:opacity-90"
                            style={{ background: "var(--gradient-btn-primary)" }}
                        >
                            <Home className="w-3.5 h-3.5 mr-1.5" /> Ana Sayfaya Git
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
