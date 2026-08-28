<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  type Props = {
    open?: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  };

  let {
    open = false,
    title = '',
    message = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    danger = false,
    onConfirm,
    onCancel,
  }: Props = $props();

  function cancel() {
    onCancel?.();
  }

  function confirm() {
    onConfirm?.();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter') confirm();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center p-4"
    transition:fade={{ duration: 150 }}
    role="presentation"
  >
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-black/50"
      aria-label={cancelText}
      onclick={cancel}
    ></button>

    <div
      class="relative z-10 w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl"
      transition:scale={{ duration: 150, start: 0.95 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <h2 class="text-base font-semibold text-foreground">{title}</h2>
      <p class="mt-2 text-sm text-muted-foreground">{message}</p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onclick={cancel}
          class="inline-flex h-10 cursor-pointer items-center justify-center rounded-3xl border px-5 text-sm text-muted-foreground transition hover:bg-accent"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onclick={confirm}
          class={`inline-flex h-10 cursor-pointer items-center justify-center rounded-3xl px-5 text-sm font-medium text-white transition ${
            danger
              ? 'bg-destructive hover:bg-destructive/90'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
