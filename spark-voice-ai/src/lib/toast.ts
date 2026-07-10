import { toast } from 'sonner';
import { ApiError } from './api';

export function notifyError(err: unknown, fallback = 'Algo deu errado') {
  const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;
  toast.error(msg);
}

export { toast };
