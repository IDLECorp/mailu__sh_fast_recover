<script lang="ts">
  import { Send, Loader2, X, Paperclip, Minus, Maximize2 } from 'lucide-svelte';
  import { beforeNavigate } from '$app/navigation';

  let {
    show,
    onClose,
  }: {
    show: boolean;
    onClose: () => void;
  } = $props();

  let to = $state('');
  let cc = $state('');
  let subject = $state('');
  let text = $state('');
  let showCc = $state(false);
  let sending = $state(false);
  let minimized = $state(false);
  let files = $state<File[]>([]);
  let hasContent = $derived(to || subject || text);

  function reset() {
    to = '';
    cc = '';
    subject = '';
    text = '';
    showCc = false;
    sending = false;
    minimized = false;
    files = [];
  }

  function onFiles(ev: Event) {
    const target = ev.target as HTMLInputElement;
    if (target?.files) files = [...files, ...Array.from(target.files)];
    target.value = '';
  }

  function removeFile(idx: number) {
    files = files.filter((_, i) => i !== idx);
  }

  function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function saveDraft() {
    if (!hasContent) return;
    try {
      await fetch('/api/compose/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text }),
      });
    } catch {
      // silent
    }
  }

  function handleClose() {
    saveDraft();
    reset();
    onClose();
  }

  beforeNavigate(() => {
    if (hasContent) saveDraft();
  });

  async function handleSend() {
    if (!to || !subject || !text) return;
    sending = true;
    try {
      const fd = new FormData();
      fd.set('to', to);
      fd.set('cc', cc);
      fd.set('subject', subject);
      fd.set('text', text);
      for (const f of files) fd.append('attachment', f);

      const res = await fetch('/api/compose/send', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        reset();
        onClose();
      }
    } catch {
      // silent
    } finally {
      sending = false;
    }
  }
</script>

{#if show}
  <div class="fixed bottom-20 right-0 z-50 m-4 w-full max-w-lg" class:translate-y-0={!minimized}>
    <div
      class="rounded-3xl border bg-card shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
      class:h-14={minimized}
      class:max-h-[85vh]={!minimized}
    >
      <!-- Header -->
      <div class="flex items-center bg-gray-100 justify-between px-5 py-3.5 border-b shrink-0">
        <span class="text-sm font-semibold">Nuevo mensaje</span>
        <div class="flex items-center gap-1">
          <button
            onclick={() => (minimized = !minimized)}
            class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            {#if minimized}<Maximize2 class="size-4" />{:else}<Minus class="size-4" />{/if}
          </button>
          <button
            onclick={handleClose}
            class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <X class="size-4" />
          </button>
        </div>
      </div>

      {#if !minimized}
        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <!-- To -->
          <div>
            <input
              bind:value={to}
              placeholder="Para"
              type="email"
               class="w-full h-12 rounded-3xl border px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
            />
          </div>

          <!-- Cc toggle -->
          {#if !showCc}
            <button
              onclick={() => (showCc = true)}
              class="text-xs text-muted-foreground hover:text-foreground transition"
            >
              + Cc
            </button>
          {/if}

          {#if showCc}
            <div>
              <input
                bind:value={cc}
                placeholder="Cc"
                type="email"
                class="w-full h-12 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
              />
            </div>
          {/if}

          <!-- Subject -->
          <div>
            <input
              bind:value={subject}
              placeholder="Asunto"
              type="text"
              maxlength={200}
              class="w-full h-12 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
            />
          </div>

          <!-- Body + attachment inside -->
          <div class="relative border rounded-xl">
            <textarea
              bind:value={text}
              placeholder="Escribí tu mensaje…"
              rows={8}
              class="w-full rounded-3xl px-4 py-3 text-sm resize-none outline-none focus:outline-none focus:ring-0"></textarea>
            <div class="flex items-center justify-between px-2 py-1.5 border-input/50 mt-1 mx-1">
              <label
                class="cursor-pointer rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                <Paperclip class="size-4" />
                <input type="file" multiple class="hidden" onchange={onFiles} />
              </label>
              {#if files.length > 0}
                <span class="text-xs text-muted-foreground">{files.length} adjunto(s)</span>
{/if}


            </div>
            {#if files.length > 0}
              <div class="mt-2 space-y-1">
                {#each files as f, i}
                  <div
                    class="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-1.5 text-sm"
                  >
                    <Paperclip class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="flex-1 truncate">{f.name}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                    <button
                      onclick={() => removeFile(i)}
                      class="text-muted-foreground hover:text-destructive transition shrink-0"
                    >
                      <X class="size-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-5 py-3 border-t shrink-0">
          <div></div>
          <button
            onclick={handleSend}
            disabled={sending || !to || !subject || !text}
            class="inline-flex items-center justify-center gap-2 border shadow transition-all duration-300 ease-in-out cursor-pointer rounded-3xl px-8 h-12 text-sm text-muted-foreground hover:bg-[#1a86c3] hover:text-gray-100 disabled:pointer-events-none disabled:opacity-50"
          >
            {#if sending}
              <Loader2 class="size-4 animate-spin" /> Enviando…
            {:else}
              <Send class="size-4" /> Enviar
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
