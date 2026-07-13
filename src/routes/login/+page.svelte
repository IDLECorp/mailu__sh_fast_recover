<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Mail, Lock, Loader2, AlertCircle } from 'lucide-svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);

  const next = $derived(data.next ?? '/inbox');
</script>

<svelte:head><title>Iniciar sesión · Fast Mail</title></svelte:head>

<main class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="flex flex-col items-center mb-8">
      <div class="size-12 rounded-xl bg-fast-surface border border-fast-border flex items-center justify-center mb-3 text-fast-accent">
        <Mail class="size-6" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Fast Mail</h1>
      <p class="text-sm text-fast-muted mt-1">Acceso a tu correo Mailu</p>
    </div>

    <form
      method="POST"
      use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}
      class="space-y-4"
    >
      <input type="hidden" name="next" value={next} />

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-fast-muted">Email</span>
        <div class="mt-1 relative">
          <Mail class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fast-muted pointer-events-none" />
          <input
            name="email"
            type="email"
            autocomplete="username"
            required
            value={form?.email ?? ''}
            placeholder="nombre@fastrecover.com"
            class="w-full pl-9 pr-3 py-2.5 rounded-lg bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition"
          />
        </div>
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-fast-muted">Contraseña</span>
        <div class="mt-1 relative">
          <Lock class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fast-muted pointer-events-none" />
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full pl-9 pr-3 py-2.5 rounded-lg bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition"
          />
        </div>
      </label>

      {#if form?.error}
        <p class="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle class="size-4 shrink-0" />
          {form.error}
        </p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full py-2.5 rounded-lg bg-fast-accent text-fast-bg font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {#if loading}
          <Loader2 class="size-4 animate-spin" /> Entrando…
        {:else}
          Entrar
        {/if}
      </button>
    </form>

    <p class="mt-6 text-center text-xs text-fast-muted">
      Acceso sobre Mailu · IMAP/SMTP · TLS
    </p>
  </div>
</main>