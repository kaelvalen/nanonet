import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Geçerli bir email girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginForm) => {
    login(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NanoNet'e Giriş</h1>
          <p className="text-sm text-gray-500 mt-1">Servislerinizi izlemeye devam edin</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                placeholder="ornek@email.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
              <input
                {...register('password')}
                type="password"
                className="input-field"
                placeholder="En az 8 karakter"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoggingIn ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
