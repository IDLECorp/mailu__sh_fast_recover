<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import { Users, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);
  let loadingDelete = $state<string | null>(null);

  let localpart = $state('');
  let domain = $state(data.currentDomain);
  let password = $state('');
  let quota = $state('');
  void data;
</script>

<svelte:head><title>Admin · Fast Mail</title></svelte:head>

<div class="border-b border-fast-border bg-fast-surface/50">
  <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Users class="size-5 text-fast-accent" />
      <h1 class="text-sm font-medium">Admin</h1>
      <span class="text-xs text-fast-muted">· {data.currentDomain}</span>
    </div>
    <a href="/inbox" class="text-xs text-fast-muted hover:text-fast-accent">Inbox</a>
  </div>
</div>

<main class="max-w-4xl mx-auto px-4 py-6 space-y-8">
  {#if !data.adminEnabled}
    <section class="rounded-lg border border-fast-border bg-fast-surface/30 p-6 text-center">
      <h2 class="text-sm font-medium text-fast-muted">Admin deshabilitado</h2>
      <p class="text-xs text-fast-muted mt-2 max-w-md mx-auto">
        La REST API de Mailu está apagada (<code>API=false</code> en <code>/mailu/mailu.env</code>).
        Habilitá <code>API=true</code> + <code>API_TOKEN=...</code> y configurá <code>MAILU_API_KEY</code>
        en el <code>.env</code> de Fast para gestionar usuarios desde acá.
        Mientras tanto, gestioná las cuentas desde <a href="https://mail.nexuscorpec.com/admin" class="underline text-fast-accent">mail.nexuscorpec.com/admin</a>.
      </p>
    </section>
  {:else}
  <section class="rounded-lg border border-fast-border bg-fast-surface/30 p-4">
    <h2 class="text-sm font-medium mb-3 flex items-center gap-2"><Plus class="size-4 text-fast-accent" /> Crear usuario</h2>
    <form
      method="POST"
      action="?/createUser"
      use:enhance={() => { loading = true; return async ({ update }) => { loading = false; if (form?.ok) { localpart = ''; password = ''; quota = ''; } await update(); }; }}
      class="grid sm:grid-cols-4 gap-3"
    >
      <input name="localpart" placeholder="nombre" required bind:value={localpart}
        class="px-3 py-2 rounded-md bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition" />
      <select name="domain" bind:value={domain}
        class="px-3 py-2 rounded-md bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition">
        {#each data.domains as d}
          <option value={d.name}>{d.name}</option>
        {/each}
      </select>
      <input name="password" type="password" placeholder="contraseña (mín 8)" required bind:value={password}
        class="px-3 py-2 rounded-md bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition" />
      <div class="flex gap-2">
        <input name="quota" type="number" placeholder="quota MB" bind:value={quota}
          class="flex-1 px-3 py-2 rounded-md bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition" />
        <button type="submit" disabled={loading}
          class="px-3 py-2 rounded-md bg-fast-accent text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
          {#if loading}<Loader2 class="size-4 animate-spin" />{:else}<Plus class="size-4" />{/if}
        </button>
      </div>
    </form>
    {#if form?.error}
      <p class="mt-3 flex items-center gap-2 text-sm text-red-400"><AlertCircle class="size-4" />{form.error}</p>
    {/if}
  </section>

  <section>
    <h2 class="text-sm font-medium mb-3">Usuarios ({data.users.length})</h2>
    <ul class="divide-y divide-fast-border rounded-lg border border-fast-border overflow-hidden bg-fast-surface/30">
      {#each data.users as u}
        <li class="flex items-center justify-between px-4 py-2.5">
          <div class="min-w-0">
            <p class="text-sm truncate" class:opacity-50={!u.enabled}>{u.email}</p>
            <p class="text-xs text-fast-muted">domain: {u.domain}{#if u.quota} · quota: {u.quota}MB{/if}</p>
          </div>
          <form method="POST" action="?/deleteUser" use:enhance={() => { loadingDelete = u.email; return async ({ update }) => { loadingDelete = null; await update(); }; }}>
            <input type="hidden" name="email" value={u.email} />
            <button type="submit" disabled={loadingDelete === u.email} aria-label="Eliminar"
              class="p-1.5 rounded text-fast-muted hover:text-red-400 transition disabled:opacity-50">
              <Trash2 class="size-4" />
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>
  {/if}
</main>