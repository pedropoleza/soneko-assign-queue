import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (msg: string, opts?: any) => sonnerToast.success(msg, { duration: 2200, ...opts }),
  error: (msg: string, opts?: any) => sonnerToast.error(msg, { duration: 6000, ...opts }),
  info: (msg: string, opts?: any) => sonnerToast.info(msg, { duration: 4000, ...opts }),
  warning: (msg: string, opts?: any) => sonnerToast.warning(msg, { duration: 4500, ...opts }),
};
