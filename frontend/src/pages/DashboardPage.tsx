import { useServices } from '../hooks/useServices';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { services, isLoading } = useServices();
  const { logout } = useAuth();
  useWebSocket();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">NanoNet Dashboard</h1>
          <button
            onClick={() => logout()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Çıkış
          </button>
        </div>
      </nav>
      <div className="container mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Servisler</h2>
        {services.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500">Henüz servis eklenmemiş</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-2">{service.name}</h3>
                <p className="text-sm text-gray-600">
                  {service.host}:{service.port}
                </p>
                <div className="mt-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      service.status === 'up'
                        ? 'bg-green-100 text-green-800'
                        : service.status === 'down'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
