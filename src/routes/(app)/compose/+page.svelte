<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Send, AlertCircle, Loader2, Paperclip, X, Save, ArrowLeft } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);
  let savingDraft = $state(false);
  let to = $state(data.prefill?.to ?? '');
  let cc = $state(data.prefill?.cc ?? '');
  let subject = $state(data.prefill?.subject ?? '');
  let text = $state(data.prefill?.body ?? '');
  let showCc = $state(false);
  let files = $state<File[]>([]);
  let dragging = $state(false);

  function onFiles(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    if (target?.files) files = [...files, ...Array.from(target.files)];
  }
  function onDrop(ev: DragEvent): void {
    ev.preventDefault();
    dragging = false;
    if (ev.dataTransfer?.files) files = [...files, ...Array.from(ev.dataTransfer.files)];
  }
  function removeFile(idx: number): void {
    files = files.filter((_, i) => i !== idx);
  }
  function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<svelte:head><title>Redactar · Fast Mail</title></svelte:head>

<div class="flex h-full flex-col pt-4">
  <div class="bg-card px-4 py-3 sm:px-6 flex items-center gap-2">
    <Button href="/inbox" variant="ghost" size="sm">
      <ArrowLeft class="size-4" /> Descartar
    </Button>
    <div class="flex-1"></div>
    <Button form="draftForm" type="submit" variant="outline" size="sm" disabled={savingDraft}>
      {#if savingDraft}<Loader2 class="size-4 animate-spin" />{:else}<Save class="size-4" />{/if}
      Guardar borrador
    </Button>
  </div>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Card>
        <CardContent class="p-6 space-y-4">
          <form
            method="POST"
            id="sendForm"
            action="?/send"
            use:enhance={({ formData }) => {
              loading = true;
              formData.delete('attachment');
              for (const f of files) formData.append('attachment', f);
              return async ({ result, update }) => {
                loading = false;
                if (result.type === 'success' && result.data?.ok) {
                  goto('/inbox?sent=1');
                }
                await update();
              };
            }}
            enctype="multipart/form-data"
          >
            <div class="space-y-2">
              <Label for="to">Para</Label>
              <div class="flex gap-2">
                <Input
                  id="to"
                  name="to"
                  type="email"
                  multiple
                  placeholder="destinatario@dominio.com"
                  required
                  bind:value={to}
                />
                {#if !showCc}
                  <Button type="button" variant="outline" size="sm" onclick={() => (showCc = true)}
                    >Cc</Button
                  >
                {/if}
              </div>
            </div>

            {#if showCc}
              <div class="space-y-2">
                <Label for="cc">Cc</Label>
                <Input
                  id="cc"
                  name="cc"
                  type="email"
                  multiple
                  placeholder="con copia"
                  bind:value={cc}
                />
              </div>
            {/if}

            <div class="space-y-2">
              <Label for="subject">Asunto</Label>
              <Input
                id="subject"
                name="subject"
                type="text"
                required
                maxlength={200}
                bind:value={subject}
              />
            </div>

            <div class="space-y-2">
              <Label for="text">Mensaje</Label>
              <Textarea
                id="text"
                name="text"
                rows={10}
                required
                bind:value={text}
                class="font-mono"
              />
            </div>

            <input type="hidden" name="html" value="" />

            <!-- Attachments -->
            <div class="space-y-2">
              <Label for="attachment">Adjuntos</Label>
              <div
                role="button"
                tabindex="0"
                class="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition hover:bg-accent cursor-pointer"
                class:bg-accent={dragging}
                ondragover={(e) => {
                  e.preventDefault();
                  dragging = true;
                }}
                ondragleave={() => (dragging = false)}
                ondrop={onDrop}
                onclick={() => document.getElementById('attachment')?.click()}
              >
                <Paperclip class="size-5 mx-auto mb-2 opacity-60" />
                Arrastrá archivos aquí o hacé clic para seleccionar
              </div>
              <input
                id="attachment"
                name="attachment"
                type="file"
                multiple
                class="hidden"
                onchange={onFiles}
              />
              {#if files.length > 0}
                <ul class="space-y-1">
                  {#each files as f, i}
                    <li class="flex items-center gap-2 rounded-md border bg-card p-2 text-sm">
                      <Paperclip class="size-4 text-muted-foreground" />
                      <span class="flex-1 truncate">{f.name}</span>
                      <span class="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
                      <button
                        type="button"
                        onclick={() => removeFile(i)}
                        class="text-muted-foreground hover:text-destructive"
                        ><X class="size-4" /></button
                      >
                    </li>
                  {/each}
                </ul>
                <p class="text-xs text-muted-foreground">
                  Para incluirlos en el envío, volvé a seleccionarlos en el diálogo (limitación del
                  navegador). Máx 10 MB.
                </p>
              {/if}
            </div>

            {#if form?.error}
              <p class="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle class="size-4 shrink-0" />{form.error}
              </p>
            {/if}

            <!-- Hidden file inputs to include on submit. The enhance handler attaches via FormData -->
            <div id="filesBuffer"></div>

            <div class="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={loading}>
                {#if loading}<Loader2 class="size-4 animate-spin" /> Enviando…{:else}<Send
                    class="size-4"
                  /> Enviar mensaje{/if}
              </Button>
            </div>
          </form>

          <form method="POST" id="draftForm" action="?/draft" class="hidden">
            <input type="hidden" name="to" value={to} />
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="text" value={text} />
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
