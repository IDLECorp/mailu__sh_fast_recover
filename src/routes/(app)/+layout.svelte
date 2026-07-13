<script lang="ts">
  import '../../app.css';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';
  import { Inbox, Send, FilePen, Trash2, Archive, OctagonAlert, Mail, Plus, LogOut, Menu, Search, User as UserIcon } from 'lucide-svelte';
  import { cn } from '$lib/utils';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Avatar } from '$lib/components/ui/avatar';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  let sidebarOpen = $state(false);

  const iconForSpecial = (su: string | null) => {
    if (su === '\\Inbox') return Inbox;
    if (su === '\\Sent') return Send;
    if (su === '\\Drafts') return FilePen;
    if (su === '\\Trash') return Trash2;
    if (su === '\\Junk') return OctagonAlert;
    if (su === '\\Archive') return Archive;
    return Mail;
  };

  const hrefFor = (m: { path: string; specialUse: string | null }) => {
    if (m.specialUse === '\\Inbox') return '/inbox';
    return `/folder/${encodeURIComponent(m.path)}`;
  };

  </script>

<svelte:head><title>Fast Mail</title></svelte:head>

<div class="flex h-screen overflow-hidden bg-background">
  <!-- Mobile backdrop -->
  {#if sidebarOpen}
    <button class="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-label="Cerrar menú" onclick={() => (sidebarOpen = false)}></button>
  {/if}

  <!-- Sidebar -->
  <aside class={cn('absolute inset-y-0 left-0 z-40 w-64 border-r bg-card flex flex-col transition-transform lg:static lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
    <div class="flex h-14 items-center gap-2 border-b px-4">
      <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        <Mail class="size-4" />
      </div>
      <div class="flex flex-col -space-y-0.5">
        <span class="text-sm font-semibold tracking-tight">Fast Mail</span>
        <span class="text-[10px] uppercase tracking-wider text-muted-foreground">SH Fast Recover</span>
      </div>
    </div>

    <div class="p-3">
      <Button href="/compose" size="sm" class="w-full" onclick={() => (sidebarOpen = false)}>
        <Plus class="size-4" /> Redactar
      </Button>
    </div>

    <nav class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
      {#each data.mailboxes as m}
        {@const Icon = iconForSpecial(m.specialUse)}
        {@const href = hrefFor(m)}
        <a
          {href}
          onclick={() => (sidebarOpen = false)}
          class={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', page.url.pathname === href ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')}
        >
          <Icon class="size-4 shrink-0" />
          <span class="flex-1 truncate">{m.label}</span>
          {#if m.unseen > 0}
            <span class="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 min-w-[18px] text-center">{m.unseen}</span>
          {/if}
        </a>
      {/each}

      <div class="pt-2 mt-2 border-t">
        <a
          href="/admin"
          onclick={() => (sidebarOpen = false)}
          class={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', page.url.pathname === '/admin' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/60')}
        >
          <UserIcon class="size-4 shrink-0" />
          Admin
        </a>
      </div>
    </nav>

    <div class="border-t p-3">
      <div class="flex items-center gap-2">
        <Avatar alt={data.user?.email ?? ''} fallback={data.user?.email ?? ''} />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium truncate">{data.user?.email}</p>
          <p class="text-[10px] text-muted-foreground truncate">{data.user?.domain}</p>
        </div>
        <form method="POST" action="/logout">
          <button type="submit" class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition" aria-label="Salir">
            <LogOut class="size-4" />
          </button>
        </form>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <header class="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
      <button class="lg:hidden rounded-md p-2 hover:bg-accent" aria-label="Abrir menú" onclick={() => (sidebarOpen = true)}>
        <Menu class="size-4" />
      </button>
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar correo…"
          class="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </header>

    <main class="flex-1 overflow-y-auto bg-muted/30">
      {@render children?.()}
    </main>
  </div>
</div>