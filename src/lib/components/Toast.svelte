<script lang="ts">
  import { Toaster } from 'svelte-sonner';
</script>

<!--
  Contenedor global de notificaciones (toasts).
  Configurado para verse bien tanto en tema claro como oscuro,
  con colores segun el tipo (verde = ok, rojo = error) y un
  boton para cerrar. Posicion arriba al centro: no tapa la
  lista de correos ni el compositor (abajo a la derecha).
-->
<Toaster
  richColors
  closeButton
  position="top-center"
  toastOptions={{ style: 'border-radius: 0.75rem;' }}
/>
