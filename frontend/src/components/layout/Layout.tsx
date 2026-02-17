import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../ui/ErrorBoundary';

export default function Layout() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Navbar />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
