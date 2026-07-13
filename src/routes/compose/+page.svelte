<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  import { Send, AlertCircle, Loader2 } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let { form }: { form: ActionData } = $props();
  let loading = $state(false);
  let to = $state('');
  let subject = $state('');
  let text = $state('');
</script>

<svelte:head><title>Redactar · Fast Mail</title></svelte:head>

<div class="border-b border-fast-border bg-fast-surface/50">
  <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
    <h1 class="text-sm font-medium">Redactar</h1>
    <a href="/inbox" class="text-xs text-fast-muted hover:text-fast-accent">Volver</a>
  </div>
</div>

<main class="max-w-3xl mx-auto px-4 py-6">
  <form
    method="POST"
    use:enhance={() => { loading = true; return async ({ result, update }) => { loading = false; if (result.type === 'success' && result.data?.ok) { goto('/inbox'); } await update(); }; }}
    class="space-y-3"
  >
    <label class="block">
      <span class="text-xs uppercase tracking-wide text-fast-muted">Para</span>
      <input name="to" type="email" multiple required bind:value={to}
        class="mt-1 w-full px-3 py-2 rounded-lg bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition" />
    </label>

    <label class="block">
      <span class="text-xs uppercase tracking-wide text-fast-muted">Asunto</span>
      <input name="subject" type="text" required maxlength="200" bind:value={subject}
        class="mt-1 w-full px-3 py-2 rounded-lg bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition" />
    </label>

    <label class="block">
      <span class="text-xs uppercase tracking-wide text-fast-muted">Mensaje</span>
      <textarea name="text" rows="12" required bind:value={text}
        class="mt-1 w-full px-3 py-2 rounded-lg bg-fast-surface border border-fast-border focus:border-fast-accent text-sm outline-none transition font-mono"></textarea>
    </label>

    <input type="hidden" name="html" value="" />

    {#if form?.error}
      <p class="flex items-center gap-2 text-sm text-red-400">
        <AlertCircle class="size-4 shrink-0" />{form.error}
      </p>
    {/if}

    <div class="flex justify-end">
      <button type="submit" disabled={loading}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fast-accent text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50">
        {#if loading}
          <Loader2 class="size-4 animate-spin" /> Enviando…
        {:else}
          <Send class="size-4" /> Enviar
        {/if}
      </button>
    </div>
  </form>
</main>