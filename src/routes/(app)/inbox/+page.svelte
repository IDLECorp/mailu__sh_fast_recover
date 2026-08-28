<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import {
    Trash2,
    MailOpen,
    ChevronLeft,
    ChevronRight,
    Inbox as InboxIcon,
    Paperclip,
    ArrowRight,
    Loader2,
  } from 'lucide-svelte';
  import { cn } from '$lib/utils';
  import { Avatar } from '$lib/components/ui/avatar';
  import { toast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let busyUid = $state<number | null>(null);
  let confirmOpen = $state(false);
  let pendingUid = $state<number | null>(null);

  function fmtDate(d: Date): string {
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  }

  function senderName(from: string): string {
    if (!from) return 'Remitente desconocido';
    const m = from.match(/^(.*?)\s*<.*>$/);
    return (m?.[1] || from).trim();
  }

  function senderInitials(from: string): string {
    const name = senderName(from);
    return name.slice(0, 2).toUpperCase();
  }
</script>

<svelte:head><title>Bandeja · Fast Mail</title></svelte:head>

<div class="flex h-full flex-col pt-4">
  <div class=" bg-card px-4 py-3 sm:px-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <InboxIcon class="size-4 text-primary" />
        <h1 class="text-sm font-semibold">{data.mailboxLabel}</h1>
        <span class="text-xs text-muted-foreground">· {data.total} mensajes</span>
      </div>
    </div>
  </div>

  <div class="flex-1 pt-4 overflow-y-auto">
    {#if data.messages.length === 0}
      <div class="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <InboxIcon class="size-12 mb-3 opacity-40" />
        <p class="text-sm">No hay mensajes en esta carpeta</p>
      </div>
    {:else}
      <ul class="divide-y">
        {#each data.messages as m}
          <li
            class="group relative flex gap-3 px-4 py-4 transition-colors hover:bg-accent/40 sm:px-6"
            class:bg-accent={!m.seen}
          >
            <a
              href={`/thread/${m.uid}?mailbox=${encodeURIComponent(data.mailbox)}`}
              class="absolute inset-0 z-10"
              aria-label={m.subject}
            ></a>
            {#if !m.seen}
              <span
                class="absolute left-1 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary"
              ></span>
            {/if}

            <Avatar
              alt={m.from}
              fallback={senderInitials(m.from)}
              class="size-9 mt-0.5 z-20 bg-[#1b82bb] pointer-events-none text-white"
            />

            <div class="min-w-0 flex-1 z-20 pointer-events-none">
              <div class="flex items-baseline justify-between gap-3">
                <span class={cn('text-sm truncate', !m.seen && 'font-semibold')}
                  >{senderName(m.from)}</span
                >
              </div>
              <p
                class={cn(
                  'text-sm truncate mt-0.5',
                  !m.seen ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {m.subject}
              </p>
              {#if m.hasAttachments}
                <div class="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Paperclip class="size-3" /> Adjunto
                </div>
              {/if}
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-30">
              <form
                method="POST"
                action="?/markRead"
                use:enhance={() => {
                  busyUid = m.uid;
                  return async ({ result, update }) => {
                    await update();
                    busyUid = null;
                    if (result.type === 'failure') {
                      toast.error('No se pudo marcar el correo como leído.');
                    }
                  };
                }}
              >
                <input type="hidden" name="uid" value={m.uid} />
                <button
                  type="submit"
                  disabled={busyUid === m.uid}
                  aria-label="Marcar leído"
                  class="rounded-md p-1.5 hover:bg-accent hover:text-foreground text-muted-foreground transition disabled:opacity-50"
                >
                  {#if busyUid === m.uid}<Loader2 class="size-4 animate-spin" />{:else}<MailOpen
                      class="size-4"
                    />{/if}
                </button>
              </form>
              <form
                id={'delete-form-' + m.uid}
                method="POST"
                action="?/delete"
                use:enhance={() => {
                  busyUid = m.uid;
                  return async ({ result, update }) => {
                    await update();
                    busyUid = null;
                    if (result.type === 'success' && result.data?.ok) {
                      toast.success('Correo movido a la papelera.');
                    } else if (result.type === 'failure') {
                      toast.error('No se pudo eliminar el correo. Intentá de nuevo.');
                    }
                  };
                }}
              >
                <input type="hidden" name="uid" value={m.uid} />
                <button
                  type="button"
                  disabled={busyUid === m.uid}
                  aria-label="Eliminar"
                  onclick={() => {
                    if (busyUid !== m.uid) {
                      pendingUid = m.uid;
                      confirmOpen = true;
                    }
                  }}
                  class="rounded-md p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition disabled:opacity-50"
                >
                  {#if busyUid === m.uid}<Loader2 class="size-4 animate-spin" />{:else}<Trash2
                      class="size-4"
                    />{/if}
                </button>
              </form>
              <span class="text-xs text-muted-foreground shrink-0">{fmtDate(m.date)}</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if form && !form.ok}
      <div
        class="absolute bottom-4 right-4 bg-destructive text-destructive-foreground text-sm px-4 py-2 rounded-md shadow-lg"
      >
        No se pudo completar la acción
      </div>
    {/if}
  </div>

  <ConfirmModal
    open={confirmOpen}
    title="Mover a la papelera"
    message="¿Seguro que querés mover este correo a la papelera?"
    confirmText="Sí, mover"
    cancelText="Cancelar"
    danger={true}
    onConfirm={() => {
      const uid = pendingUid;
      if (uid === null) return;
      confirmOpen = false;
      pendingUid = null;
      const f = document.getElementById('delete-form-' + uid) as HTMLFormElement | null;
      f?.requestSubmit();
    }}
    onCancel={() => {
      confirmOpen = false;
      pendingUid = null;
    }}
  />

  {#if data.messages.length > 0}
    <nav class="flex items-center justify-between px-6 py-4 text-sm border-t bg-card">
      <a
        href={`?page=${Math.max(1, data.page - 1)}`}
        class="inline-flex items-center justify-center gap-2 border shadow transition-all duration-300 ease-in-out cursor-pointer rounded-3xl px-6 h-12 text-sm text-muted-foreground hover:bg-[#1a86c3] hover:text-gray-100 disabled:pointer-events-none disabled:opacity-50"
        class:pointer-events-none={data.page <= 1}
        class:opacity-50={data.page <= 1}
      >
        <ChevronLeft class="size-4" /> Anterior
      </a>
      <span class="text-xs text-muted-foreground">Página {data.page} de {data.pages}</span>
      <a
        href={`?page=${Math.min(data.pages, data.page + 1)}`}
        class="inline-flex items-center justify-center gap-2 border shadow transition-all duration-300 ease-in-out cursor-pointer rounded-3xl px-6 h-12 text-sm text-muted-foreground hover:bg-[#1a86c3] hover:text-gray-100 disabled:pointer-events-none disabled:opacity-50"
        class:pointer-events-none={data.page >= data.pages}
        class:opacity-50={data.page >= data.pages}
      >
        Siguiente <ChevronRight class="size-4" />
      </a>
    </nav>
  {/if}
</div>
