<script lang="ts">
  import {
    Send,
    Loader2,
    X,
    Paperclip,
    Minus,
    Maximize2,
    Minimize2,
    ALargeSmall,
    PenLine,
    Smile,
    Trash2,
  } from 'lucide-svelte';
  import { beforeNavigate } from '$app/navigation';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import ToolbarButton from '$lib/components/rich-text/ToolbarButton.svelte';
  import ToolbarPopover from '$lib/components/rich-text/ToolbarPopover.svelte';
  import EmojiPicker from '$lib/components/rich-text/EmojiPicker.svelte';
  import { cn } from '$lib/utils';
  import { toast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { hasMeaningfulText } from '$lib/compose-html';
  import {
    buildSignatureHtml,
    containsSignature,
    removeSignatureFromHtml,
    type SignatureIdentity,
  } from '$lib/compose-signature';

  /** El id por defecto de RichTextEditor.svelte (no se le pasa `id` propio),
   * usado para mover el foco al contenteditable sin agregarle props nuevas
   * (diseño §8.4; §2.6 "no se agregan props de firma"). */
  const EDITOR_ELEMENT_ID = 'rich-text-editor';

  /** Máquina de tres estados excluyentes (diseño §8.1, RF-26/RF-27). Un solo
   * valor ⇒ los estados inválidos son irrepresentables. */
  type ComposeWindowState = 'minimized' | 'docked' | 'expanded';

  let {
    show,
    onClose,
    user,
  }: {
    show: boolean;
    onClose: () => void;
    user: SignatureIdentity;
  } = $props();

  let to = $state('');
  let cc = $state('');
  let bcc = $state('');
  let subject = $state('');
  let text = $state('');
  let html = $state('');
  let showCc = $state(false);
  let showBcc = $state(false);
  let priority = $state('normal');
  let error = $state('');
  let sending = $state(false);
  let windowState = $state<ComposeWindowState>('docked');
  let includeSignature = $state(true);
  let files = $state<File[]>([]);
  let panelEl = $state<HTMLDivElement | undefined>();
  /** [T-28 — C11, diseño §15.6.1] Visibilidad de la toolbar de formato.
   * Oculta por defecto (paridad Gmail). Sesión de UI: persiste mientras el
   * compositor esté abierto, se reinicia en reset() → sin persistencia
   * entre mensajes (mismo criterio que RF-24). */
  let showFormatToolbar = $state(false);
  /** [T-29 — RF-38, diseño §15.7] Referencia al editor, solo para insertar
   * emoji desde el botón del footer. Si `svelte-check` no aceptara el
   * componente en posición de tipo (R21), el fallback estructural es
   * `$state<{ insertEmoji: (e: string) => void } | undefined>()` — se
   * confirma en T-31 cuál de los dos quedó vigente. */
  let editorRef = $state<RichTextEditor | undefined>();
  /** [T-29 — RF-36] <input type="file"> oculto: el <label> anterior se
   * reemplaza por un ToolbarButton que lo dispara. `onFiles` sin cambios. */
  let fileInputEl = $state<HTMLInputElement | undefined>();
  let recentEmojis = $state<string[]>([]);
  let hasContent = $derived(!!(to || subject || hasMeaningfulText(text)));
  /** Confirmacion de envio solo para correos pesados o con muchos destinatarios,
   * para no molestar en el flujo normal (criterio del cliente). */
  let sendConfirmOpen = $state(false);
  let sendArmed = $state(false);

  function recipientCount(): number {
    const parts = [to, cc, bcc].filter(Boolean).join(',');
    return parts ? parts.split(',').filter((p) => p.trim().length > 0).length : 0;
  }

  function needsSendConfirm(): boolean {
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    return totalSize > 5 * 1024 * 1024 || recipientCount() > 5;
  }

  function reset() {
    to = '';
    cc = '';
    bcc = '';
    subject = '';
    text = '';
    html = '';
    showCc = false;
    showBcc = false;
    priority = 'normal';
    error = '';
    sending = false;
    windowState = 'docked';
    includeSignature = true; // RF-24: sin persistencia entre mensajes
    files = [];
    showFormatToolbar = false; // [T-29] sin persistencia entre mensajes (C11)
    recentEmojis = [];
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

  /** [T-29 — diseño §15.5] Evita que el mousedown sobre los íconos del footer
   * mueva el foco fuera del contenteditable. NO llama a `saveSelection()`:
   * esa función es privada de RichTextEditor y no hace falta — el editor
   * mantiene `savedRange` al día con su listener de `selectionchange` más
   * onkeyup/onmouseup/onfocus (ver R20, diseño §15.11). */
  function keepEditorSelection(event: MouseEvent): void {
    event.preventDefault();
  }

  /** [T-29 — RF-40 · C12 Variante A, diseño §15.8] Descarte SOLO LOCAL.
   * Corta las dos rutas de guardado de esa acción de cierre: (1) no invoca
   * saveDraft() (a diferencia de handleClose) → CA-37; (2) reset() deja
   * to/subject/text vacíos ANTES de onClose(), así que el `hasContent` que
   * lea el beforeNavigate posterior ya es false y no vuelve a guardar
   * contenido ya descartado. NO toca IMAP: un borrador ya guardado por un
   * autoguardado previo permanece en la carpeta Borradores (limitación
   * declarada y aceptada, ver 04-tasks.md T-29 / 03-design.md §15.8). */
  function handleDiscard(): void {
    reset();
    onClose();
  }

  /** Diseño §7.5 — toggle "Incluir firma" (RF-24). Cambiar `html` dispara el
   * `$effect` del editor (E6, T-10), que actualiza `text` en el mismo paso. */
  function onToggleSignature(next: boolean): void {
    includeSignature = next;
    if (next) {
      if (!containsSignature(html)) html = html + buildSignatureHtml(user);
    } else {
      html = removeSignatureFromHtml(html);
    }
  }

  function focusEditor(): void {
    document.getElementById(EDITOR_ELEMENT_ID)?.focus();
  }

  async function saveDraft() {
    if (!hasContent) return;
    try {
      await fetch('/api/compose/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, bcc, subject, text, html }),
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
    error = '';
    // [C9 — diseño §14.1] Con la firma activa por defecto, `text` casi nunca
    // queda vacío (incluye "-- \nNombre\nemail\ndominio" salvo que el usuario
    // la borre a mano). Se usa hasMeaningfulText() — el mismo chequeo canónico
    // de compose-html.ts que usa el editor y el sanitizador — en vez del
    // `!text` ad-hoc anterior, pero esto NO restaura protección alguna contra
    // "enviar un mensaje que solo contiene la firma": el diseño decide
    // explícitamente no agregar un diálogo de confirmación para ese caso
    // (spec §8 ya lo trata como contenido válido). Documentado, no corregido.
    if (!to || !subject || !hasMeaningfulText(text)) {
      error = 'Completá destinatario, asunto y mensaje.';
      return;
    }
    // Confirmacion de envio solo cuando el correo es pesado o tiene muchos
    // destinatarios, para no interrumpir el flujo normal.
    if (!sendArmed && needsSendConfirm()) {
      sendConfirmOpen = true;
      return;
    }
    sendArmed = false;
    sendConfirmOpen = false;
    sending = true;
    try {
      const fd = new FormData();
      fd.set('to', to);
      fd.set('cc', cc);
      fd.set('bcc', bcc);
      fd.set('subject', subject);
      fd.set('text', text);
      fd.set('html', html);
      fd.set('priority', priority);
      for (const f of files) fd.append('attachment', f);

      const res = await fetch('/api/compose/send', { method: 'POST', body: fd });
      const data = await res.json();
      // El modal siempre se cierra y avisamos con un toast. Los mensajes son
      // nuestros (en criollo) y no exponen el error crudo que devuelve el server.
      reset();
      onClose();
      if (data.ok) {
        toast.success('¡Listo! El correo se envió.');
      } else {
        toast.error('Hubo un error con el sistema. No se pudo enviar el correo.');
      }
    } catch {
      reset();
      onClose();
      toast.error('Hubo un error con el sistema. Intentá de nuevo más tarde.');
    } finally {
      sending = false;
    }
  }

  function confirmSend() {
    sendArmed = true;
    handleSend();
  }

  // ─── Diseño §7.4 — inserción de firma al abrir un compositor nuevo ────────
  // Capa 1 de idempotencia: solo se antepone si `includeSignature` está
  // activo y el HTML todavía no trae una firma nuestra (borrador reabierto —
  // hoy no ejercitable desde este componente, C2 — o reapertura futura).
  let previousShow = false;
  $effect(() => {
    if (show && !previousShow && includeSignature && !containsSignature(html)) {
      html = '<div><br></div>' + buildSignatureHtml(user);
    }
    previousShow = show;
  });

  // ─── Diseño §8.4 — foco entre transiciones (sin focus trap) ───────────────
  let previousWindowState: ComposeWindowState = 'docked';
  $effect(() => {
    const current = windowState;
    if (!show) {
      previousWindowState = current;
      return;
    }
    const previous = previousWindowState;
    if (current === 'expanded' && previous !== 'expanded') {
      if (!(panelEl && document.activeElement && panelEl.contains(document.activeElement))) {
        focusEditor();
      }
    } else if (previous === 'minimized' && current !== 'minimized') {
      focusEditor();
    }
    previousWindowState = current;
  });

  // ─── Diseño §8.4 — bloqueo de scroll, solo en `expanded` ───────────────────
  $effect(() => {
    if (!show || windowState !== 'expanded') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  });

  // Escape acopla a `docked`, nunca cierra (diseño §8.1).
  $effect(() => {
    if (!show || windowState !== 'expanded') return;
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') windowState = 'docked';
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

{#if show}
  {#if windowState === 'expanded'}
    <button
      type="button"
      aria-label="Contraer el compositor"
      class="fixed inset-0 z-40 cursor-default bg-black/30 backdrop-blur-[1px]"
      onclick={() => (windowState = 'docked')}
    ></button>
  {/if}

  <div
    class={windowState === 'expanded'
      ? 'fixed inset-0 z-50 flex items-center justify-center sm:p-4'
      : 'fixed bottom-20 right-0 z-50 m-4 w-full max-w-lg'}
  >
    <div
      bind:this={panelEl}
      class={cn(
        'flex flex-col overflow-hidden border bg-card shadow-2xl transition-all duration-300',
        windowState === 'expanded'
          ? 'h-full w-full rounded-none sm:h-[85vh] sm:w-[85vw] sm:min-h-[28rem] sm:min-w-[32rem] sm:max-h-[calc(100vh-2rem)] sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl'
          : 'rounded-3xl',
        windowState === 'minimized' && 'h-14',
        windowState === 'docked' && 'max-h-[85vh]',
      )}
    >
      <!-- Header -->
      <div class="flex items-center bg-gray-100 justify-between px-5 py-3.5 border-b shrink-0">
        <span class="text-sm font-semibold">Nuevo mensaje</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onclick={() => (windowState = windowState === 'minimized' ? 'docked' : 'minimized')}
            class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label={windowState === 'minimized' ? 'Restaurar' : 'Minimizar'}
          >
            <Minus class="size-4" />
          </button>
          {#if windowState !== 'expanded'}
            <button
              type="button"
              onclick={() => (windowState = 'expanded')}
              class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Expandir"
            >
              <Maximize2 class="size-4" />
            </button>
          {:else}
            <button
              type="button"
              onclick={() => (windowState = 'docked')}
              class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Contraer"
            >
              <Minimize2 class="size-4" />
            </button>
          {/if}
          <button
            type="button"
            onclick={handleClose}
            class="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label="Cerrar"
          >
            <X class="size-4" />
          </button>
        </div>
      </div>

      <!-- [R10] class:hidden en vez de {#if}: RichTextEditor y su
           contenteditable NUNCA se desmontan entre estados (diseño §8.3,
           base estructural de CA-27). El contenedor oculto conserva
           `flex flex-1 flex-col overflow-hidden`. -->
      <div class="flex flex-1 flex-col overflow-hidden" class:hidden={windowState === 'minimized'}>
        <!-- Body -->
        <div class="composer-scrollbar flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-5">
          <!-- [T-27 — RF-32/CA-29, diseño §15.3] Fila "Para" + toggles Cc/Cco
               integrados en un único contenedor de fila; cada toggle tiene su
               propio {#if}, ya no hace falta el envoltorio conjunto de antes. -->
          <div class="flex items-center gap-2">
            <input
              bind:value={to}
              placeholder="Para"
              type="email"
              class="h-10 min-w-0 flex-1 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
            />
            {#if !showCc}
              <button
                type="button"
                onclick={() => (showCc = true)}
                class="shrink-0 rounded-full px-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                + Cc
              </button>
            {/if}
            {#if !showBcc}
              <button
                type="button"
                onclick={() => (showBcc = true)}
                class="shrink-0 rounded-full px-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                + Cco
              </button>
            {/if}
          </div>

          <!-- [C10.3 — diseño §15.1/§15.3] El CAMPO Cc no se mueve: sigue en
               su fila propia debajo de "Para". Solo hereda el h-10 de T-26. -->
          {#if showCc}
            <input
              bind:value={cc}
              placeholder="Cc"
              type="email"
              class="w-full h-10 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
            />
          {/if}

          {#if showBcc}
            <input
              bind:value={bcc}
              placeholder="Cco"
              type="email"
              class="w-full h-10 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
            />
          {/if}

          <div class="flex items-center gap-2 px-1">
            <span class="text-xs text-muted-foreground">Prioridad</span>
            <div class="flex items-center gap-1.5" role="group" aria-label="Prioridad">
              <button
                type="button"
                aria-label="Prioridad normal"
                aria-pressed={priority === 'normal'}
                title="Prioridad normal"
                onclick={() => (priority = 'normal')}
                class={cn(
                  'size-4 cursor-pointer rounded-full bg-yellow-400 transition-all duration-150',
                  priority === 'normal'
                    ? 'ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-card'
                    : 'opacity-45 hover:opacity-80',
                )}
              ></button>
              <button
                type="button"
                aria-label="Prioridad alta"
                aria-pressed={priority === 'high'}
                title="Prioridad alta"
                onclick={() => (priority = 'high')}
                class={cn(
                  'size-4 cursor-pointer rounded-full bg-red-500 transition-all duration-150',
                  priority === 'high'
                    ? 'ring-2 ring-red-500/50 ring-offset-2 ring-offset-card'
                    : 'opacity-45 hover:opacity-80',
                )}
              ></button>
            </div>
          </div>

          <input
            bind:value={subject}
            placeholder="Asunto"
            type="text"
            maxlength={200}
            class="w-full h-10 rounded-3xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
          />

          <!-- [T-28 — RF-34, diseño §15.4] El box con borde propio se
               disuelve: RichTextEditor ya dibuja el suyo, así que
               `relative rounded-xl border` duplicaba un borde. La sub-barra
               de adjuntar que vivía acá pasó al footer (T-29). -->
          <div class="flex min-h-0 flex-1 flex-col space-y-3">
            <RichTextEditor
              bind:this={editorRef}
              bind:html
              bind:text
              showToolbar={showFormatToolbar}
              class="flex min-h-0 flex-1 flex-col"
              minHeightClass="min-h-40 flex-1"
            />

            {#if files.length > 0}
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">{files.length} adjunto(s)</span>
                {#each files as f, i}
                  <div
                    class="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-1.5 text-sm"
                  >
                    <Paperclip class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="flex-1 truncate">{f.name}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      onclick={() => removeFile(i)}
                      class="text-muted-foreground hover:text-destructive transition shrink-0"
                      aria-label="Quitar {f.name}"
                    >
                      <X class="size-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          {#if error}
            <p class="text-sm text-destructive">{error}</p>
          {/if}
        </div>

        <!-- [T-29 — RF-34…RF-40 · CA-31, diseño §15.5] Barra de acciones
             inferior: "Enviar" a la izquierda, cinco controles de acción a
             la derecha (Aa · adjuntar · emoji · firma · papelera). -->
        <div class="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3">
          <button
            type="button"
            onclick={handleSend}
            disabled={sending || !to || !subject || !hasMeaningfulText(text)}
            class="brand-action inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-3xl border px-8 text-sm text-muted-foreground shadow transition-all duration-300 ease-in-out disabled:pointer-events-none disabled:opacity-50"
          >
            {#if sending}
              <Loader2 class="size-4 animate-spin" /> Enviando…
            {:else}
              <Send class="size-4" /> Enviar
            {/if}
          </button>

          <div class="flex items-center gap-0.5">
            <!-- RF-35 · C11 — toggle "Aa". tabindex={0} EXPLÍCITO: sin
                 roving en el footer (mitigación R19, diseño §15.5 detalle 1). -->
            <ToolbarButton
              label="Opciones de formato"
              pressed={showFormatToolbar}
              tabindex={0}
              tooltipPlacement="top"
              onclick={() => (showFormatToolbar = !showFormatToolbar)}
            >
              {#snippet icon()}<ALargeSmall class="size-4" />{/snippet}
            </ToolbarButton>

            <!-- RF-36 — adjuntar. `onFiles` SIN CAMBIOS (RNF-07). -->
            <ToolbarButton
              label="Adjuntar archivo"
              tabindex={0}
              tooltipPlacement="top"
              onclick={() => fileInputEl?.click()}
            >
              {#snippet icon()}<Paperclip class="size-4" />{/snippet}
            </ToolbarButton>
            <input bind:this={fileInputEl} type="file" multiple class="hidden" onchange={onFiles} />

            <!-- RF-38 — emoji, fuera de la toolbar colapsable (diseño §15.7). -->
            <ToolbarPopover
              label="Insertar emoji"
              tabindex={0}
              placement="top"
              align="end"
              onpreserveSelection={keepEditorSelection}
            >
              {#snippet icon()}<Smile class="size-4" />{/snippet}
              {#snippet panel({ close })}
                <EmojiPicker
                  bind:recent={recentEmojis}
                  onselect={(emoji) => {
                    editorRef?.insertEmoji(emoji);
                    close();
                  }}
                />
              {/snippet}
            </ToolbarPopover>

            <!-- RF-39 — firma. `onToggleSignature` SIN CAMBIOS de firma ni
                 semántica (RNF-07). -->
            <ToolbarButton
              label="Incluir firma"
              pressed={includeSignature}
              tabindex={0}
              tooltipPlacement="top"
              onclick={() => onToggleSignature(!includeSignature)}
            >
              {#snippet icon()}<PenLine class="size-4" />{/snippet}
            </ToolbarButton>

            <!-- RF-40 · C12 Variante A — descartar. Etiqueta honesta: NO
                 promete borrado remoto (diseño §15.8). -->
            <ToolbarButton
              label="Descartar y cerrar"
              tabindex={0}
              tooltipPlacement="top"
              onclick={handleDiscard}
            >
              {#snippet icon()}<Trash2 class="size-4" />{/snippet}
            </ToolbarButton>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ConfirmModal
    open={sendConfirmOpen}
    title="¿Enviamos este correo?"
    message="Revisá que el destinatario, el asunto y los adjuntos estén bien antes de enviarlo."
    confirmText="Sí, enviar"
    cancelText="Cancelar"
    onConfirm={confirmSend}
    onCancel={() => {
      sendConfirmOpen = false;
    }}
  />
{/if}

<style>
  .composer-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklab, var(--muted-foreground) 45%, transparent) transparent;
    overscroll-behavior: contain;
  }

  .composer-scrollbar::-webkit-scrollbar {
    width: 7px;
  }

  .composer-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .composer-scrollbar::-webkit-scrollbar-thumb {
    border: 1px solid transparent;
    border-radius: 999px;
    background: color-mix(in oklab, var(--muted-foreground) 38%, transparent);
    background-clip: padding-box;
  }

  .composer-scrollbar::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--primary) 55%, transparent);
    background-clip: padding-box;
  }

  .composer-scrollbar::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
</style>
