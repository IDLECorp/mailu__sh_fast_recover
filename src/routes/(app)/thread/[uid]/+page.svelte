<script lang="ts">
  import type { PageData } from './$types';
  import { ArrowLeft, Reply, Forward, Trash2, Paperclip, Download, Mail } from 'lucide-svelte';
  import { Avatar } from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
  import { sanitizeEmailHtml } from '$lib/sanitize';

  let { data }: { data: PageData } = $props();

  const m = $derived(data.detail);
  let body = $derived(
    m.html
      ? sanitizeEmailHtml(m.html)
      : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(m.text)}</pre>`,
  );
  const senderName = $derived(m.from.match(/^(.*?)\s*<.*>$/)?.[1]?.trim() || m.from);

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(d: Date): string {
    return d.toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' });
  }

  function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<svelte:head><title>{m.subject} · Fast Mail</title></svelte:head>

<div class="flex h-full flex-col pt-4">
  <!-- Top bar -->
  <div class="flex items-center gap-2 bg-card px-4 py-3 sm:px-6">
    <Button
      href={data.mailbox === 'INBOX' ? '/inbox' : `/folder/${encodeURIComponent(data.mailbox)}`}
      variant="ghost"
      size="sm"
    >
      <ArrowLeft class="size-4" /> Volver
    </Button>
    <div class="flex-1"></div>
    <Button
      href={`/compose?reply=${data.uid}&mailbox=${encodeURIComponent(data.mailbox)}`}
      variant="outline"
      size="sm"
    >
      <Reply class="size-4" /> Responder
    </Button>
    <Button
      href={`/compose?forward=${data.uid}&mailbox=${encodeURIComponent(data.mailbox)}`}
      variant="outline"
      size="sm"
    >
      <Forward class="size-4" />
    </Button>
  </div>

  <!-- Message -->
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <!-- Subject -->
      <h1 class="text-xl font-semibold tracking-tight mb-4">{m.subject}</h1>

      <!-- Sender card -->
      <div class="flex items-start gap-3 mb-6">
        <Avatar
          alt={m.from}
          fallback={senderName.slice(0, 2).toUpperCase()}
          class="size-10 bg-[#1b82bb] text-white"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <div>
              <p class="text-sm font-medium">{senderName}</p>
              <p class="text-xs text-muted-foreground truncate">{m.from}</p>
            </div>
            <time class="text-xs text-muted-foreground shrink-0">{fmtDate(m.date)}</time>
          </div>
          {#if m.to}
            <p class="text-xs text-muted-foreground mt-1 truncate">Para: {m.to}</p>
          {/if}
          {#if m.cc}
            <p class="text-xs text-muted-foreground truncate">Cc: {m.cc}</p>
          {/if}
        </div>
      </div>

      <!-- Body -->
      <div class="prose prose-sm max-w-none border-t pt-4">
        <!-- svelte-ignore html_with_external_script html_script_tag -->
        <div
          class="email-body [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_table]:max-w-full"
        >
          {@html body}
        </div>
      </div>

      <!-- Attachments -->
      {#if m.attachments.length > 0}
        <div class="border-t mt-6 pt-4 space-y-2">
          <h2 class="text-sm font-medium flex items-center gap-2 mb-2">
            <Paperclip class="size-4" /> Adjuntos ({m.attachments.length})
          </h2>
          <ul class="grid sm:grid-cols-2 gap-2">
            {#each m.attachments as a}
              {@const href = `/api/attachment?uid=${data.uid}&mailbox=${encodeURIComponent(data.mailbox)}&filename=${encodeURIComponent(a.filename)}`}
              <li>
                <a
                  {href}
                  class="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-accent transition text-sm"
                >
                  <div
                    class="size-8 rounded border flex items-center justify-center text-muted-foreground"
                  >
                    <Paperclip class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate">{a.filename}</p>
                    <p class="text-xs text-muted-foreground">{a.contentType} · {fmtSize(a.size)}</p>
                  </div>
                  <Download class="size-4 text-muted-foreground" />
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</div>
