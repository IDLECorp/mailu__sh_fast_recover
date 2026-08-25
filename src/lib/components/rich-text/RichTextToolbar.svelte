<script lang="ts">
  import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Check,
    Highlighter,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Link,
    List,
    ListOrdered,
    Palette,
    Quote,
    Strikethrough,
    Type,
    Underline,
  } from 'lucide-svelte';
  import {
    FONT_FAMILIES,
    FONT_FAMILY_LABELS,
    FONT_SIZES,
    FONT_SIZE_LABELS,
    COMPOSE_COLOR_PALETTE,
    type Alignment,
    type FontFamily,
    type FontSize,
  } from '$lib/compose-format';
  import type { EditorAction, FormatState } from '../RichTextEditor.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import ToolbarPopover from './ToolbarPopover.svelte';
  import LinkPopover from './LinkPopover.svelte';

  let {
    format,
    onaction,
    onpreserveSelection,
  }: {
    format: FormatState;
    onaction: (action: EditorAction) => void;
    onpreserveSelection: (event: MouseEvent) => void;
  } = $props();

  // ─── Roving tabindex (RF-18 / RNF-04 / CA-18, diseño §9.4) ───────────────
  // Un solo control con tabindex="0" a la vez; el resto "-1". `Tab` entra y
  // sale del conjunto como una unidad; ArrowRight/ArrowLeft mueven el foco
  // con envolvimiento; Home/End van a los extremos. Excepción obligatoria
  // (R6): si el foco está en un <select>, las flechas no se interceptan.
  let toolbarEl: HTMLDivElement | undefined = $state();
  let rovingIndex = $state(0);

  function tabIndexFor(index: number): number {
    return rovingIndex === index ? 0 : -1;
  }

  const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End']);

  function handleToolbarKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'SELECT' || target.tagName === 'INPUT') return;
    if (!NAV_KEYS.has(event.key) || !toolbarEl) return;

    const controls = Array.from(toolbarEl.querySelectorAll<HTMLElement>('[data-roving="true"]'));
    if (controls.length === 0) return;
    const currentIndex = controls.indexOf(target);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % controls.length;
    else if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + controls.length) % controls.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = controls.length - 1;

    event.preventDefault();
    rovingIndex = nextIndex;
    controls[nextIndex]?.focus();
  }

  // Selects: onfocus guarda la selección del editor SIN preventDefault (R5,
  // §9.5) — a diferencia de los botones, que usan onmousedown+preventDefault.
  // `onpreserveSelection` está tipado para MouseEvent (contrato exacto de
  // §3.5); su implementación real (`preserveSelection` en RichTextEditor.svelte)
  // no toca ninguna propiedad específica de MouseEvent, así que reutilizarla
  // para un FocusEvent es seguro en tiempo de ejecución. Cast documentado
  // (judgment call de sdd-apply, T-09).
  function saveSelectionOnFocus(event: FocusEvent): void {
    onpreserveSelection(event as unknown as MouseEvent);
  }

  function handleFontFamilyChange(event: Event & { currentTarget: HTMLSelectElement }): void {
    onaction({ kind: 'fontFamily', value: event.currentTarget.value as FontFamily | '' });
  }

  function handleFontSizeChange(event: Event & { currentTarget: HTMLSelectElement }): void {
    onaction({ kind: 'fontSize', value: event.currentTarget.value as FontSize | '' });
  }

  function align(value: Alignment): void {
    onaction({ kind: 'align', value });
  }

  // [R7] Reintento de formatBlock('blockquote') vive en RichTextEditor.dispatch
  // (T-10); la toolbar solo dispara la intención.
  function toggleBlockquote(): void {
    onaction({ kind: 'blockquote' });
  }

  function chooseColor(kind: 'color' | 'backgroundColor' | 'highlight', value: string): void {
    onaction({ kind, value });
  }

  function handleLinkSubmit(payload: { href: string; textIfEmpty: string }): boolean {
    // `onaction` está tipado `(a: EditorAction) => void` en el contrato de
    // §3.5 (sin canal de retorno). En tiempo de ejecución, `dispatch()` en
    // RichTextEditor.svelte SÍ devuelve un booleano de éxito para 'link'
    // (§4.2.3/§10.2: "si createLink devuelve false, el popover... no
    // cierra"). Se necesita ese valor aquí para decidir si LinkPopover
    // permanece abierto. Cast documentado (judgment call de sdd-apply, T-09):
    // no cambia el tipo público de la prop, solo lee el valor real devuelto.
    const dispatchWithResult = onaction as unknown as (action: EditorAction) => boolean | void;
    const result = dispatchWithResult({ kind: 'link', ...payload });
    return result !== false;
  }
</script>

<div
  bind:this={toolbarEl}
  class="flex flex-wrap items-center gap-1 border-b border-input p-1.5"
  role="toolbar"
  tabindex="-1"
  aria-label="Formato del mensaje"
  aria-orientation="horizontal"
  onkeydown={handleToolbarKeydown}
>
  <!-- Grupo 1: Fuente -->
  <Type class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  <select
    aria-label="Familia de fuente"
    data-roving="true"
    tabindex={tabIndexFor(0)}
    value={format.fontFamily}
    onfocus={saveSelectionOnFocus}
    onchange={handleFontFamilyChange}
    class="h-8 max-w-[7rem] truncate rounded-md border border-input bg-background px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {#each FONT_FAMILIES as family (family)}
      <option value={family}>{FONT_FAMILY_LABELS[family]}</option>
    {/each}
  </select>
  <select
    aria-label="Tamaño de letra"
    data-roving="true"
    tabindex={tabIndexFor(1)}
    value={format.fontSize}
    onfocus={saveSelectionOnFocus}
    onchange={handleFontSizeChange}
    class="h-8 max-w-[7rem] truncate rounded-md border border-input bg-background px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {#each FONT_SIZES as size (size)}
      <option value={size}>{FONT_SIZE_LABELS[size]}</option>
    {/each}
  </select>

  <div class="mx-1 h-5 w-px bg-border"></div>

  <!-- Grupo 2: Énfasis -->
  <ToolbarButton
    label="Negrita"
    pressed={format.bold}
    tabindex={tabIndexFor(2)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'bold' })}
  >
    {#snippet icon()}<Bold class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Cursiva"
    pressed={format.italic}
    tabindex={tabIndexFor(3)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'italic' })}
  >
    {#snippet icon()}<Italic class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Subrayado"
    pressed={format.underline}
    tabindex={tabIndexFor(4)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'underline' })}
  >
    {#snippet icon()}<Underline class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Tachado"
    pressed={format.strike}
    tabindex={tabIndexFor(5)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'strike' })}
  >
    {#snippet icon()}<Strikethrough class="size-4" />{/snippet}
  </ToolbarButton>

  <div class="mx-1 h-5 w-px bg-border"></div>

  <!-- Grupo 3: Color del texto -->
  <ToolbarPopover
    label="Colores"
    tabindex={tabIndexFor(6)}
    data-roving="true"
    {onpreserveSelection}
    align="end"
    viewportBounded
  >
    {#snippet icon()}<Palette class="size-4" />{/snippet}
    {#snippet panel({ close })}
      <div class="color-popover-grid grid w-[min(19rem,calc(100vw-2rem))] gap-3">
        <section aria-label="Color del texto">
          <h3 class="mb-2 text-xs font-semibold">Color del texto</h3>
          <div class="grid grid-cols-6 gap-1" role="group" aria-label="Color del texto">
            {#each COMPOSE_COLOR_PALETTE as color (color.hex)}
              <button
                type="button"
                class="relative size-5 rounded-sm border border-black/15 transition hover:scale-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                style="background-color: {color.hex}"
                aria-label="Texto {color.label}"
                aria-pressed={format.color === color.hex}
                title={color.label}
                onmousedown={onpreserveSelection}
                onclick={() => {
                  chooseColor('color', color.hex);
                  close(false);
                }}
              >
                {#if format.color === color.hex}
                  <Check class="absolute inset-0 m-auto size-3.5 text-white mix-blend-difference" />
                {/if}
              </button>
            {/each}
          </div>
        </section>
      </div>
    {/snippet}
  </ToolbarPopover>

  <!-- Selector dedicado de color de fondo (resaltado). El estado presionado
       comparte `format.backgroundColor`: setHighlightColor escribe la misma
       propiedad inline que detecta computeFormatState. -->
  <ToolbarPopover
    label="Color de fondo"
    tabindex={tabIndexFor(7)}
    data-roving="true"
    {onpreserveSelection}
    align="end"
    viewportBounded
  >
    {#snippet icon()}<Highlighter class="size-4" />{/snippet}
    {#snippet panel({ close })}
      <section aria-label="Paleta de color de fondo">
        <h3 class="mb-2 text-xs font-semibold">Color de fondo</h3>
        <div class="grid grid-cols-6 gap-1" role="group" aria-label="Paleta de color de fondo">
          {#each COMPOSE_COLOR_PALETTE as color (color.hex)}
            <button
              type="button"
              class="relative size-5 rounded-sm border border-black/15 transition hover:scale-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              style="background-color: {color.hex}"
              aria-label={`${color.label} de fondo`}
              aria-pressed={format.backgroundColor === color.hex}
              title={color.label}
              onmousedown={onpreserveSelection}
              onclick={() => {
                chooseColor('highlight', color.hex);
                close(false);
              }}
            >
              {#if format.backgroundColor === color.hex}
                <Check class="absolute inset-0 m-auto size-3.5 text-white mix-blend-difference" />
              {/if}
            </button>
          {/each}
        </div>
      </section>
    {/snippet}
  </ToolbarPopover>

  <div class="mx-1 h-5 w-px bg-border"></div>

  <!-- Grupo 4: Alineación -->
  <ToolbarButton
    label="Alinear a la izquierda"
    pressed={format.align === 'left'}
    tabindex={tabIndexFor(8)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => align('left')}
  >
    {#snippet icon()}<AlignLeft class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Centrar"
    pressed={format.align === 'center'}
    tabindex={tabIndexFor(9)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => align('center')}
  >
    {#snippet icon()}<AlignCenter class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Alinear a la derecha"
    pressed={format.align === 'right'}
    tabindex={tabIndexFor(10)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => align('right')}
  >
    {#snippet icon()}<AlignRight class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Justificar"
    pressed={format.align === 'justify'}
    tabindex={tabIndexFor(11)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => align('justify')}
  >
    {#snippet icon()}<AlignJustify class="size-4" />{/snippet}
  </ToolbarButton>

  <div class="mx-1 h-5 w-px bg-border"></div>

  <!-- Grupo 5: Listas y sangría -->
  <ToolbarButton
    label="Lista numerada"
    pressed={format.orderedList}
    tabindex={tabIndexFor(12)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'orderedList' })}
  >
    {#snippet icon()}<ListOrdered class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Lista de viñetas"
    pressed={format.unorderedList}
    tabindex={tabIndexFor(13)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'unorderedList' })}
  >
    {#snippet icon()}<List class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Aumentar sangría"
    disabled={!format.canIndent}
    tabindex={tabIndexFor(14)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'indent' })}
  >
    {#snippet icon()}<IndentIncrease class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarButton
    label="Disminuir sangría"
    disabled={!format.canOutdent}
    tabindex={tabIndexFor(15)}
    data-roving="true"
    {onpreserveSelection}
    onclick={() => onaction({ kind: 'outdent' })}
  >
    {#snippet icon()}<IndentDecrease class="size-4" />{/snippet}
  </ToolbarButton>

  <div class="mx-1 h-5 w-px bg-border"></div>

  <!-- Grupo 6: Bloque / insertar -->
  <ToolbarButton
    label="Cita"
    pressed={format.blockquote}
    tabindex={tabIndexFor(16)}
    data-roving="true"
    {onpreserveSelection}
    onclick={toggleBlockquote}
  >
    {#snippet icon()}<Quote class="size-4" />{/snippet}
  </ToolbarButton>
  <ToolbarPopover
    label="Insertar vínculo"
    tabindex={tabIndexFor(17)}
    data-roving="true"
    {onpreserveSelection}
  >
    {#snippet icon()}<Link class="size-4" />{/snippet}
    {#snippet panel({ close })}
      <LinkPopover
        onsubmit={(payload) => {
          const ok = handleLinkSubmit(payload);
          if (ok) close();
          return ok;
        }}
      />
    {/snippet}
  </ToolbarPopover>
</div>

<style>
  @media (max-width: 21rem) {
    .color-popover-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
