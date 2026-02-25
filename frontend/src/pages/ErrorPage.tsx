import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Unexpected Error";
  let message = "Something went wrong. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} — ${error.statusText}`;
    message = error.data?.message ?? message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f0f4ff] via-[#e8f4ff] to-[#f5f0ff] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white/80 backdrop-blur-sm border border-[#e2e8f0] rounded-2xl shadow-lg p-10 max-w-md w-full text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#fda4af]/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-[#e11d48]" />
          </div>
        </div>

        <h1 className="text-lg font-bold text-[#3b4563] mb-2">{title}</h1>
        <p className="text-sm text-[#7c8db5] mb-8 leading-relaxed">{message}</p>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="border-[#e2e8f0] text-[#7c8db5] rounded-lg text-xs h-8 hover:bg-[#f8faff]"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" /> Go back
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/", { replace: true })}
            className="bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-lg text-xs h-8 border-0 hover:opacity-90"
          >
            <Home className="w-3 h-3 mr-1.5" /> Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
