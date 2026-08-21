<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageData } from './$types';
  import { Search, ArrowLeft, Inbox as InboxIcon, Paperclip } from 'lucide-svelte';
  import { cn } from '$lib/utils';
  import { Avatar } from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let { data }: { data: PageData } = $props();

  let q = $state(data.query);
  let scope = $state(data.scope);
  let hasResults = $derived(data.hits && data.hits.length > 0);

  const scopes = [
    { value: 'all', label: 'Todo' },
    { value: 'from', label: 'De' },
    { value: 'subject', label: 'Asunto' },
    { value: 'body', label: 'Contenido' },
  ];

  function runSearch(ev: SubmitEvent): void {
    ev.preventDefault();
    const u = new URL(page.url);
    if (q.trim()) u.searchParams.set('q', q.trim());
    else u.searchParams.delete('q');
    u.searchParams.set('scope', scope);
    goto(u.pathname + '?' + u.searchParams.toString(), { keepFocus: true, noScroll: true });
  }

  function senderName(from: string): string {
    if (!from) return 'Remitente desconocido';
    const m = from.match(/^(.*?)\s*<.*>$/);
    return (m?.[1] || from).trim();
  }

  function fmtDate(d: Date): string {
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  }

  let mailboxHref = $derived(
    data.email && data.hits?.[0]?.mailbox
      ? `/folder/${encodeURIComponent(data.hits[0].mailbox)}`
      : '/inbox',
  );
</script>

<svelte:head><title>Buscar · Idec Mails</title></svelte:head>

<div class="flex h-full flex-col pt-4">
  <div class="bg-card px-4 py-3 sm:px-6">
    <div class="flex items-center gap-3 mb-3">
      <Button href="/inbox" variant="ghost" size="sm"><ArrowLeft class="size-4" /> Volver</Button>
      <h1 class="text-sm font-semibold flex items-center gap-2">
        <Search class="size-4 text-primary" /> Búsqueda
      </h1>
    </div>
    <form class="flex gap-2 items-end" onsubmit={runSearch}>
      <div class="flex-1 space-y-1.5">
        <Label for="q">Buscar</Label>
        <Input id="q" bind:value={q} placeholder="texto a buscar…" autocomplete="off" />
      </div>
      <div class="space-y-1.5">
        <Label for="scope">En</Label>
        <select
          id="scope"
          bind:value={scope}
          class="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each scopes as s}<option value={s.value}>{s.label}</option>{/each}
        </select>
      </div>
      <Button type="submit" size="default"><Search class="size-4" /> Buscar</Button>
    </form>
  </div>

  <div class="flex-1 pt-4 overflow-y-auto">
    {#if !data.query}
      <div class="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search class="size-12 mb-3 opacity-40" />
        <p class="text-sm">Escribí algo para buscar en tu correo</p>
      </div>
    {:else if !hasResults}
      <div class="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <InboxIcon class="size-12 mb-3 opacity-40" />
        <p class="text-sm">Sin resultados para "{data.query}"</p>
      </div>
    {:else}
      <p class="px-6 pt-4 text-xs text-muted-foreground">
        {data.hits.length} resultado(s) para "{data.query}"
      </p>
      <ul class="divide-y">
        {#each data.hits as m}
          <li
            class="group relative flex gap-3 px-4 py-4 transition-colors hover:bg-accent/40 sm:px-6"
            class:bg-accent={!m.seen}
          >
            <a
              href={`/thread/${m.uid}?mailbox=${encodeURIComponent(m.mailbox)}`}
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
              fallback={senderName(m.from).slice(0, 2).toUpperCase()}
              class="size-9 mt-0.5 z-20 bg-[#0d5ea0] pointer-events-none text-white"
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
              <p class="text-xs text-muted-foreground mt-0.5">{m.mailbox}</p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-30">
              <span class="text-xs text-muted-foreground shrink-0">{fmtDate(m.date)}</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
