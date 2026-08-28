<script lang="ts">
  import '../../app.css';
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { LayoutData } from './$types';
  import {
    Inbox,
    Send,
    FilePen,
    Trash2,
    Archive,
    OctagonAlert,
    Mail,
    Plus,
    LogOut,
    Menu,
    Search,
    User as UserIcon,
  } from 'lucide-svelte';
  import { cn } from '$lib/utils';
  import { page } from '$app/state';
  import { Avatar } from '$lib/components/ui/avatar';
  import ComposeModal from '$lib/components/ComposeModal.svelte';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  let sidebarOpen = $state(false);
  let userMenuOpen = $state(false);
  let composeOpen = $state(false);
  let userName = $derived(
    data.user?.email ? data.user.email.split('@')[0].replace(/[._-]/g, ' ') : '',
  );
  let userDisplay = $derived(userName.charAt(0).toUpperCase() + userName.slice(1));

  function clickOutside(node: HTMLElement, onEvent: () => void) {
    function handler(e: MouseEvent) {
      if (!node.contains(e.target as Node)) onEvent();
    }
    document.addEventListener('click', handler, true);
    return {
      destroy() {
        document.removeEventListener('click', handler, true);
      },
    };
  }

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

<div class="flex h-screen overflow-hidden">
  <!-- Mobile backdrop -->
  {#if sidebarOpen}
    <button
      class="fixed inset-0 z-30 bg-black/40 lg:hidden"
      aria-label="Cerrar menú"
      onclick={() => (sidebarOpen = false)}
    ></button>
  {/if}

  <!-- Sidebar -->
  <aside
    class={cn(
      'absolute px-2 inset-y-0 left-0 z-40 w-80 bg-[#e6eff5]/50 flex flex-col transition-transform lg:static lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full',
    )}
  >
    <div class="flex h-20 items-center gap-4 border-b px-4">
      <div class="size-8 rounded-lg flex items-center justify-center text-primary">
        <Mail class="size-4" />
      </div>
      <div class="flex flex-col -space-y-0.5">
        <span class="font-semibold tracking-tight">Fast Mail</span>
        <span class="text-xs uppercase tracking-wider text-muted-foreground">Fast Mail</span>
      </div>
    </div>

    <div class="py-4">
      <button
        class="w-full cursor shadow text-gray-800 hover:text-white transition-all duration-300 hover:bg-[#1b82bb] cursor-pointer gap-2 flex items-center justify-center h-12 rounded-3xl"
        onclick={() => { sidebarOpen = false; composeOpen = true; }}
      >
        <Plus class="size-4" />
        Redactar
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto rounded-3xl px-2 pb-4 space-y-0.5">
      {#each data.mailboxes as m}
        {@const Icon = iconForSpecial(m.specialUse)}
        {@const href = hrefFor(m)}
        <a
          {href}
          onclick={() => (sidebarOpen = false)}
          class={cn(
            'flex items-center gap-2 rounded-xl px-3 py-4 text-sm transition-colors',
            page.url.pathname === href
              ? 'bg-accent font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon class="size-4 shrink-0" />
          <span class="flex-1 truncate">{m.label}</span>
          {#if m.unseen > 0}
            <span
              class="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 min-w-[18px] text-center"
              >{m.unseen}</span
            >
          {/if}
        </a>
      {/each}

      <div class="pt-2 mt-2 border-t">
        <a
          href="/admin"
          onclick={() => (sidebarOpen = false)}
          class={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
            page.url.pathname === '/admin'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/60',
          )}
        >
          <UserIcon class="size-4 shrink-0" />
          Administración
        </a>
      </div>
    </nav>
  </aside>

  <!-- Main -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <header class="flex h-20 bg-[#e6eff5]/50 items-center gap-3 border-b px-4 lg:px-6">
      <button
        class="lg:hidden rounded-md p-2 hover:bg-accent"
        aria-label="Abrir menú"
        onclick={() => (sidebarOpen = true)}
      >
        <Menu class="size-4" />
      </button>
      <form action="/search" method="GET" class="relative flex-1 max-w-md">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          name="q"
          placeholder="Buscar correo…"
          class="w-full h-12 rounded-3xl border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground"
        />
      </form>

      <div class="flex-1"></div>

      <!-- User menu -->
      <div class="relative" role="menu" use:clickOutside={() => (userMenuOpen = false)}>
        <button
          class="flex items-center gap-1.5 rounded-full pr-2"
          onclick={() => (userMenuOpen = !userMenuOpen)}
          aria-haspopup="true"
          aria-expanded={userMenuOpen}
        >
          <Avatar
            class="bg-[#1a86c3] cursor-pointer w-10 h-10 text-white"
            alt={data.user?.email ?? ''}
            fallback={data.user?.email ?? ''}
          />
        </button>
        {#if userMenuOpen}
          <div
            class="absolute right-0 top-full mt-1.5 w-96 flex flex-col items-center justify-center rounded-lg border bg-card shadow-lg z-50 overflow-hidden"
            transition:fly={{ y: -4, duration: 100, opacity: 0 }}
          >
            <div class="px-3 py-4 border-b flex flex-col items-center gap-2">
              <Avatar
                class="w-20 h-20 bg-[#bfe5f4] text-2xl"
                alt={data.user?.email ?? ''}
                fallback={data.user?.email ?? ''}
              />
              <p class="text-sm font-medium truncate">{data.user?.email}</p>
              <p class="text-sm text-muted-foreground">¡Hola! Estás en el área de {userDisplay}</p>
            </div>
            <div class="p-1 py-8">
              <form method="POST" action="/logout">
                <button
                  type="submit"
                  class="flex w-full border shadow transition-all duration-300 ease-in-out cursor-pointer rounded-3xl items-center gap-2 px-12 h-12 text-sm text-muted-foreground hover:bg-[#1a86c3] hover:text-gray-100"
                >
                  <LogOut class="size-4" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        {/if}
      </div>
    </header>

    <main class="flex-1 overflow-y-auto bg-muted/30">
      {@render children?.()}
    </main>
  </div>
</div>

<ComposeModal show={composeOpen} onClose={() => (composeOpen = false)} user={data.user} />
