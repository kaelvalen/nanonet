import { LogOut, Wifi, WifiOff, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWSStore } from '../../store/wsStore';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { logout } = useAuth();
  const isConnected = useWSStore((s) => s.isConnected);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-lg font-bold text-gray-900">NanoNet</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => navigate('/dashboard')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  location.pathname === '/dashboard'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Dashboard
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-50">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-700 font-medium hidden sm:inline">Bağlı</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs text-yellow-700 font-medium hidden sm:inline">Bağlantı yok</span>
                </>
              )}
            </div>

            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>

            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
