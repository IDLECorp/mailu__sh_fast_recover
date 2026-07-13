<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import { Inbox, Trash2, MailOpen, ChevronLeft, ChevronRight, Mail as MailIcon } from 'lucide-svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let busyUid = $state<number | null>(null);
</script>

<svelte:head><title>Bandeja · Fast Mail</title></svelte:head>

<div class="border-b border-fast-border bg-fast-surface/50">
  <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <MailIcon class="size-5 text-fast-accent" />
      <div>
        <p class="text-sm font-medium">Bandeja de entrada</p>
        <p class="text-xs text-fast-muted">{data.email} · {data.total} mensajes</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <a href="/compose" class="px-3 py-1.5 rounded-md bg-fast-accent text-white text-xs font-medium hover:opacity-90 transition">Redactar</a>
      <form method="POST" action="/logout">
        <button type="submit" class="px-3 py-1.5 rounded-md border border-fast-border text-xs hover:bg-fast-surface transition">Salir</button>
      </form>
    </div>
  </div>
</div>

<main class="max-w-5xl mx-auto px-4 py-6">
  {#if data.messages.length === 0}
    <div class="text-center py-24 text-fast-muted">
      <Inbox class="size-10 mx-auto mb-3 opacity-40" />
      <p class="text-sm">No hay mensajes en tu bandeja</p>
    </div>
  {:else}
    <ul class="divide-y divide-fast-border rounded-lg border border-fast-border overflow-hidden bg-fast-surface/30">
      {#each data.messages as m, i}
        <li class="flex items-center gap-3 px-4 py-3 hover:bg-fast-surface transition group" class:font-medium={!m.seen} class:text-fast-muted={m.seen}>
          <span class="w-1.5 h-1.5 rounded-full shrink-0" class:bg-fast-accent={!m.seen} class:bg-transparent={m.seen}></span>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <span class="text-sm truncate" class:font-semibold={!m.seen}>{m.from || '(remitente desconocido)'}</span>
              <span class="text-xs text-fast-muted hidden sm:inline">{m.date.toLocaleString('es-EC')}</span>
            </div>
            <p class="text-sm text-fast-muted truncate mt-0.5">{m.subject}</p>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <form method="POST" action="?/markRead" use:enhance={() => { busyUid = m.uid; return async ({ update }) => { await update(); busyUid = null; }; }}>
              <input type="hidden" name="uid" value={m.uid} />
              <button type="submit" disabled={busyUid === m.uid} aria-label="Marcar leído" class="p-1.5 rounded text-fast-muted hover:text-fast-accent transition disabled:opacity-50">
                <MailOpen class="size-4" />
              </button>
            </form>
            <form method="POST" action="?/delete" use:enhance={() => { busyUid = m.uid; return async ({ update }) => { await update(); busyUid = null; }; }}>
              <input type="hidden" name="uid" value={m.uid} />
              <button type="submit" disabled={busyUid === m.uid} aria-label="Eliminar" class="p-1.5 rounded text-fast-muted hover:text-red-400 transition disabled:opacity-50">
                <Trash2 class="size-4" />
              </button>
            </form>
          </div>
        </li>
      {/each}
    </ul>

    <nav class="flex items-center justify-between mt-4 text-sm">
      <a href={`?page=${Math.max(1, data.page - 1)}`} class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-fast-border hover:bg-fast-surface transition disabled:opacity-40" class:opacity-40={data.page <= 1} class:pointer-events-none={data.page <= 1}>
        <ChevronLeft class="size-4" />
      </a>
      <span class="text-xs text-fast-muted">Página {data.page} de {data.pages}</span>
      <a href={`?page=${Math.min(data.pages, data.page + 1)}`} class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-fast-border hover:bg-fast-surface transition disabled:opacity-40" class:opacity-40={data.page >= data.pages} class:pointer-events-none={data.page >= data.pages}>
        <ChevronRight class="size-4" />
      </a>
    </nav>
  {/if}

  {#if form && !form.ok}
    <p class="mt-4 text-sm text-red-400">No se pudo completar la acción. Reintentá.</p>
  {/if}
</main>