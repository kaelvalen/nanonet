import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('Geçerli bir email girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, isRegistering } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterForm) => {
    registerUser(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NanoNet'e Kayıt</h1>
          <p className="text-sm text-gray-500 mt-1">Servislerinizi izlemeye başlayın</p>
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
              disabled={isRegistering}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              {isRegistering && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRegistering ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}
