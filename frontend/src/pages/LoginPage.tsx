import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Loader2, Activity, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

const loginSchema = z.object({
  email: z.string().email('Geçerli bir email girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginForm) => {
    login(data);
  };

  return (
    <div className="min-h-screen flex bg-[#0f1117]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)' }} />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Nano<span className="text-indigo-400">Net</span>
            </span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Servislerinizi<br />
            <span className="text-indigo-400">gerçek zamanlı</span> izleyin
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed max-w-md">
            Agent tabanlı metrik toplama, AI destekli anomali tespiti ve tek tıkla servis yönetimi.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold text-white">{'<'}200ms</div>
              <div className="text-xs text-gray-500 mt-1">Metrik gecikmesi</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">99.5%</div>
              <div className="text-xs text-gray-500 mt-1">Uptime hedefi</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">AI</div>
              <div className="text-xs text-gray-500 mt-1">Anomali analizi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Nano<span className="text-indigo-400">Net</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Tekrar hoş geldiniz</h1>
            <p className="text-sm text-gray-500 mt-2">Hesabınıza giriş yaparak servislerinizi izlemeye devam edin</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email adresi</label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                placeholder="ornek@email.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Şifre</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="En az 8 karakter"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  {errors.password.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-sm"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {isLoggingIn ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Ücretsiz kayıt olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
