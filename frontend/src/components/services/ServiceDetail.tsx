import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Service } from '../../types/service';

interface ServiceDetailProps {
  service: Service;
  onClose: () => void;
}

export default function ServiceDetail({ service, onClose }: ServiceDetailProps) {
  const navigate = useNavigate();

  useEffect(() => {
    onClose();
    navigate(`/services/${service.id}`);
  }, [service.id, navigate, onClose]);

  return null;
}
