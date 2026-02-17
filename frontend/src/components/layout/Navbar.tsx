import { useState, useRef, useEffect } from 'react';
import { LogOut, WifiOff, Bell, User, ChevronDown, Activity } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWSStore } from '../../store/wsStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { logout } = useAuth();
  const isConnected = useWSStore((s) => s.isConnected);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                Nano<span className="text-indigo-400">Net</span>
              </span>
            </button>

            <div className="hidden sm:flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  location.pathname === '/dashboard'
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Dashboard
              </button>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}>
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="hidden sm:inline">Canlı</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bağlantı yok</span>
                </>
              )}
            </div>

            {/* Notifications */}
            <button className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors relative">
              <Bell className="w-[18px] h-[18px]" />
            </button>

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 card p-1.5 animate-scale-in z-50">
                  <div className="px-3 py-2.5 border-b border-white/[0.06] mb-1">
                    <p className="text-sm font-medium text-white truncate">{user?.email || 'Kullanıcı'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Ücretsiz Plan</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connection lost banner */}
      {!isConnected && (
        <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 py-1.5">
          <div className="max-w-[1440px] mx-auto flex items-center gap-2 text-xs text-amber-400">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Sunucu bağlantısı kesildi. Yeniden bağlanmaya çalışılıyor...</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Bekleniyor
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
