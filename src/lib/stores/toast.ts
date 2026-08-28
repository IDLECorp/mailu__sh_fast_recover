import { toast as sonnerToast } from 'svelte-sonner';

/**
 * Store simple de notificaciones (toasts) para Fast Mail.
 * Envuelve svelte-sonner para mantener un mensaje y una duracion
 * coherentes en toda la app, siempre en espanol criollo y claro.
 */
export const toast = {
  success: (msg: string) => sonnerToast.success(msg, { duration: 4000 }),
  error: (msg: string) => sonnerToast.error(msg, { duration: 5000 }),
  info: (msg: string) => sonnerToast(msg, { duration: 4000 }),
  warning: (msg: string) => sonnerToast.warning(msg, { duration: 5000 }),
};
