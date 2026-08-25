<script module lang="ts">
  import type { Alignment, FontFamily, FontSize } from '$lib/compose-format';

  /** Único punto de entrada de la toolbar hacia el motor (diseño §3.5, E7). */
  export type EditorAction =
    | { kind: 'bold' }
    | { kind: 'italic' }
    | { kind: 'underline' }
    | { kind: 'strike' }
    | { kind: 'align'; value: Alignment }
    | { kind: 'orderedList' }
    | { kind: 'unorderedList' }
    | { kind: 'indent' }
    | { kind: 'outdent' }
    | { kind: 'blockquote' }
    | { kind: 'fontSize'; value: FontSize | '' }
    | { kind: 'fontFamily'; value: FontFamily | '' }
    | { kind: 'color'; value: string }
    | { kind: 'highlight'; value: string }
    | { kind: 'backgroundColor'; value: string }
    | { kind: 'link'; href: string; textIfEmpty: string }
    | { kind: 'emoji'; value: string };

  export interface FormatState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    align: Alignment | null;
    orderedList: boolean;
    unorderedList: boolean;
    blockquote: boolean;
    fontSize: FontSize | ''; // '' = neutro (RF-12)
    fontFamily: FontFamily | ''; // '' = neutro (RF-12)
    color: string;
    backgroundColor: string;
    canIndent: boolean;
    canOutdent: boolean;
  }

  const EMPTY_FORMAT: FormatState = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: null,
    orderedList: false,
    unorderedList: false,
    blockquote: false,
    fontSize: '',
    fontFamily: '',
    color: '',
    backgroundColor: '',
    canIndent: true,
    canOutdent: false,
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import RichTextToolbar from './rich-text/RichTextToolbar.svelte';
  import {
    escapeHtml,
    normalizeComposedDom,
    plainTextToHtml,
  } from '$lib/compose-html';
  import {
    INDENT_MAX_PX,
    INDENT_STEP_PX,
    normalizeColor,
    normalizeFontFamily,
    normalizeFontSize,
    parseStyleAttribute,
    serializeComposedStyle,
    type Alignment as AlignmentValue,
    type ComposedStyle,
  } from '$lib/compose-format';

  let {
    html = $bindable(''),
    text = $bindable(''),
    id = 'rich-text-editor',
    placeholder = 'Escribí tu mensaje…',
    minHeightClass = 'min-h-48',
    // [T-22 — diseño §15.6.1] 6.ª prop, no bindable. Default `true` = toolbar
    // siempre visible, comportamiento actual — es lo que mantiene `/compose`
    // en cero diff (C14, diseño §15.1) sin que esa ruta pase la prop.
    showToolbar = true,
    // Clases extra para el contenedor raíz (p. ej. flex-1 cuando el padre
    // quiere que el editor llene el alto disponible, como en ComposeModal).
    class: className = '',
  }: {
    html?: string;
    text?: string;
    id?: string;
    placeholder?: string;
    minHeightClass?: string;
    showToolbar?: boolean;
    class?: string;
  } = $props();

  let editor: HTMLDivElement;
  let savedRange: Range | null = null;
  let format = $state<FormatState>({ ...EMPTY_FORMAT });
  let rafId = 0;

  // Motor de edición (carga diferida, ver onMount). Squire no depende de las
  // APIs de comandos deprecadas del navegador y emite HTML dentro del
  // contrato (b/i/u/s + span[style]).
  let sq: import('squire-rte').default | null = null;

  // Último HTML que NOSOTROS publicamos hacia el padre. Sirve para que el
  // $effect de sincronización externa distinga un cambio real del padre del
  // eco de nuestra propia escritura: reescribir el DOM con setHTML en cada
  // tecla resetea el caret al inicio (el texto "se escribe al revés") porque
  // el limpiador interno de Squire re-estampa clases que el canonicalizador
  // elimina, y esa divergencia cosmética se percibiría como cambio externo.
  let lastLocalHtml = '';

  // ─── Preservadas literalmente del WIP (T-10) ───────────────────────────
  function hasMeaningfulText(value: string): boolean {
    return value.replace(/[​ ]/g, ' ').trim().length > 0;
  }

  function saveSelection(): void {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
  }

  function restoreSelection(): void {
    if (!savedRange || !sq) return;
    try {
      if (editor.contains(savedRange.commonAncestorContainer)) sq.setSelection(savedRange);
    } catch {
      /* rango obsoleto tras una mutación del editor */
    }
  }

  function preserveSelection(event: MouseEvent): void {
    event.preventDefault();
    saveSelection();
  }

  /**
   * Reemplaza el pegado nativo por texto plano dentro del contrato (paridad
   * con el handler anterior). Squire solo emite `willPaste` para inserciones
   * marcadas como pegado (`isPaste`), así que las inserciones de reemplazo se
   * hacen SIN esa marca: pasarla volvería a disparar este mismo handler de
   * forma recursiva.
   */
  function handleWillPaste(event: Event): void {
    const detail = (
      event as ClipboardEvent & { detail?: { text?: string; fragment?: DocumentFragment } }
    ).detail;
    if (!sq || !detail) return;
    event.preventDefault();
    if (typeof detail.text === 'string' && detail.text.length > 0) {
      const converted = plainTextToHtml(detail.text);
      if (converted) sq.insertHTML(converted);
    } else if (detail.fragment?.textContent) {
      sq.insertHTML(escapeHtml(detail.fragment.textContent));
    }
  }

  /**
   * [T-22 — RF-38, diseño §15.7] `export` para que ComposeModal la invoque vía
   * `bind:this` desde el botón de emoji de la barra inferior. El cuerpo mantiene
   * el comportamiento original (focus + restoreSelection + inserción +
   * syncValues); solo cambia el motor de inserción.
   */
  export function insertEmoji(emoji: string): void {
    editor.focus();
    restoreSelection();
    sq?.insertHTML(escapeHtml(emoji));
    syncValues();
  }

  // ─── Ancestros de bloque (compartido por sangría y detección de estado) ──
  const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE']);

  function closestAncestorWithTag(
    node: Node | null,
    tags: ReadonlySet<string>,
  ): HTMLElement | null {
    let current: Node | null = node;
    while (current && current !== editor) {
      if (current.nodeType === 1 && tags.has((current as HTMLElement).tagName)) {
        return current as HTMLElement;
      }
      current = current.parentNode;
    }
    return null;
  }

  function closestBlock(node: Node | null): HTMLElement | null {
    return closestAncestorWithTag(node, BLOCK_TAGS);
  }

  /**
   * Sube desde cada extremo del rango hasta el ancestro de bloque contenido
   * en `editor`; si no hay ninguno, no hace nada (diseño §4.2.2).
   */
  function blocksInSelection(): HTMLElement[] {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return [];
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return [];

    const startBlock = closestBlock(range.startContainer);
    const endBlock = closestBlock(range.endContainer);

    const blocks = new Set<HTMLElement>();
    if (startBlock) blocks.add(startBlock);
    if (endBlock) blocks.add(endBlock);
    return Array.from(blocks);
  }

  function parseIndentPx(value: string | undefined | null): number {
    if (!value) return 0;
    const match = value.match(/^(\d+(?:\.\d+)?)px$/);
    return match ? Number.parseFloat(match[1]) : 0;
  }

  /** Lógica de DOM pura, independiente del motor: pasos de 40 px hasta 120 px. */
  function applyIndent(direction: 1 | -1): void {
    const blocks = blocksInSelection();
    for (const block of blocks) {
      const style = parseStyleAttribute(block.getAttribute('style'));
      const current = parseIndentPx(style.marginLeft);
      const next = Math.max(0, Math.min(INDENT_MAX_PX, current + direction * INDENT_STEP_PX));
      const nextStyle: ComposedStyle = { ...style };
      if (next === 0) delete nextStyle.marginLeft;
      else nextStyle.marginLeft = `${next}px`;

      const rebuilt = serializeComposedStyle(nextStyle);
      if (rebuilt) block.setAttribute('style', rebuilt);
      else block.removeAttribute('style');
    }
  }

  /**
   * Selección no colapsada: makeLink directo sobre el texto elegido.
   * Caret colapsado: se inserta el texto visible dentro de un <a> construido
   * con escapeHtml (pasa por nuestro sanitizador vía sanitizeToDOMFragment).
   * Devuelve `true` salvo que falte el motor o la selección esté fuera.
   */
  function applyLink(href: string, textIfEmpty: string): boolean {
    if (!sq) return false;
    const selection = window.getSelection();
    const collapsed = !selection || selection.isCollapsed;
    if (collapsed) {
      const visibleText = textIfEmpty.trim() || href;
      sq.insertHTML(
        `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(visibleText)}</a>`,
      );
    } else {
      sq.makeLink(href, { target: '_blank', rel: 'noopener noreferrer' });
    }
    return true;
  }

  /**
   * Declaraciones tipográficas del contrato aplicadas SIN los setters de
   * Squire (`setFontFace`/`setFontSize`/`setTextColor`/`setHighlightColor`):
   * esos setters estampan una clase marcadora que el sanitizador elimina, y
   * `setFontFace` además concatena `, sans-serif` al valor, dejándolo fuera
   * del conjunto cerrado. Con `changeFormat` estilo-solo el DOM vivo ya queda
   * en forma canónica: sin pasada extra de `setHTML`, sin salto de caret y
   * sin perder el stack de undo.
   */
  function applyInlineDeclaration(declaration: string): void {
    sq?.changeFormat({ tag: 'SPAN', attributes: { style: declaration } }, null);
  }

  /** Quita las declaraciones indicadas de los spans con estilo en la selección. */
  function clearInlineDeclarations(keys: ReadonlyArray<keyof ComposedStyle>): void {
    sq?.modifyBlocks((fragment) => {
      for (const el of Array.from(fragment.querySelectorAll('span[style]'))) {
        const parsed = parseStyleAttribute(el.getAttribute('style'));
        let changed = false;
        for (const key of keys) {
          if (!parsed[key]) continue;
          delete parsed[key];
          changed = true;
        }
        if (!changed) continue;
        const rebuilt = serializeComposedStyle(parsed);
        if (rebuilt) el.setAttribute('style', rebuilt);
        else el.removeAttribute('style');
      }
      return fragment;
    });
  }

  /** Único punto de entrada de la toolbar hacia el motor (E7). */
  function dispatch(action: EditorAction): boolean | void {
    if (action.kind === 'emoji') {
      insertEmoji(action.value);
      return;
    }

    editor.focus();
    restoreSelection();

    let result: boolean | void = undefined;
    switch (action.kind) {
      case 'bold':
        if (format.bold) {
          sq?.removeBold();
          sq?.changeFormat(null, { tag: 'STRONG' }); // legado pegado
        } else {
          sq?.bold();
        }
        break;
      case 'italic':
        if (format.italic) {
          sq?.removeItalic();
          sq?.changeFormat(null, { tag: 'EM' }); // legado pegado
        } else {
          sq?.italic();
        }
        break;
      case 'underline':
        if (format.underline) {
          sq?.removeUnderline();
        } else {
          sq?.underline();
        }
        break;
      case 'strike':
        if (format.strike) {
          sq?.removeStrikethrough();
          sq?.changeFormat(null, { tag: 'STRIKE' }); // legado pegado
        } else {
          sq?.strikethrough();
        }
        break;
      case 'align':
        sq?.setTextAlignment(action.value);
        break;
      case 'orderedList':
        if (format.orderedList) sq?.removeList();
        else sq?.makeOrderedList();
        break;
      case 'unorderedList':
        if (format.unorderedList) sq?.removeList();
        else sq?.makeUnorderedList();
        break;
      case 'indent':
        sq?.saveUndoState(sq.getSelection());
        applyIndent(1);
        break;
      case 'outdent':
        sq?.saveUndoState(sq.getSelection());
        applyIndent(-1);
        break;
      case 'blockquote':
        if (format.blockquote) sq?.decreaseQuoteLevel();
        else sq?.increaseQuoteLevel();
        break;
      case 'fontSize':
        if (action.value === '') clearInlineDeclarations(['fontSize']);
        else applyInlineDeclaration(`font-size: ${action.value}`);
        break;
      case 'fontFamily':
        if (action.value === '') clearInlineDeclarations(['fontFamily']);
        else applyInlineDeclaration(`font-family: ${action.value}`);
        break;
      case 'color':
        applyInlineDeclaration(`color: ${action.value}`);
        break;
      case 'highlight':
        applyInlineDeclaration(`background-color: ${action.value}`);
        break;
      case 'link': {
        result = applyLink(action.href, action.textIfEmpty);
        break;
      }
    }

    syncValues();
    return result;
  }

  // ─── T-11: detección de estado activo ──────────────────────────────────
  function computeFormatState(): FormatState {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode ?? null;

    const blockquoteEl = closestAncestorWithTag(anchorNode, new Set(['BLOCKQUOTE']));
    const nearestBlock = closestBlock(anchorNode);

    // [§5.2] Solo `style` inline, nunca getComputedStyle. La primera
    // declaración no vacía gana (esté o no en el conjunto cerrado).
    let color = '';
    let colorResolved = false;
    let backgroundColor = '';
    let backgroundColorResolved = false;
    let current: Node | null = anchorNode;
    while (current && current !== editor && (!colorResolved || !backgroundColorResolved)) {
      if (current.nodeType === 1) {
        const el = current as HTMLElement;
        if (!colorResolved && el.style.color) {
          colorResolved = true;
          color = normalizeColor(el.style.color) ?? '';
        }
        if (!backgroundColorResolved && el.style.backgroundColor) {
          backgroundColorResolved = true;
          backgroundColor = normalizeColor(el.style.backgroundColor) ?? '';
        }
      }
      current = current.parentNode;
    }

    // Estado tipográfico desde estilos inline reales (getFontInfo), normalizado
    // al conjunto cerrado del contrato. Selección mixta → {} → neutro ('').
    const fontInfo = sq?.getFontInfo() ?? {};
    const fontSize = normalizeFontSize(fontInfo.fontSize ?? '') ?? '';
    const fontFamily = normalizeFontFamily(fontInfo.fontFamily ?? '') ?? '';

    // Squire escribe text-align inline sobre los bloques (setTextAlignment),
    // así que el estilo inline refleja la realidad; ausencia = neutro.
    let align: AlignmentValue | null = null;
    if (nearestBlock) {
      const blockStyle = parseStyleAttribute(nearestBlock.getAttribute('style'));
      if (blockStyle.textAlign) align = blockStyle.textAlign;
    }

    const indentPx = nearestBlock ? parseIndentPx(nearestBlock.style.marginLeft) : 0;

    const editorSq = sq;
    return {
      bold: !!editorSq && (editorSq.hasFormat('B') || editorSq.hasFormat('STRONG')),
      italic: !!editorSq && (editorSq.hasFormat('I') || editorSq.hasFormat('EM')),
      underline: !!editorSq && editorSq.hasFormat('U'),
      strike: !!editorSq && (editorSq.hasFormat('S') || editorSq.hasFormat('STRIKE')),
      orderedList: !!editorSq && editorSq.hasFormat('OL'),
      unorderedList: !!editorSq && editorSq.hasFormat('UL'),
      blockquote: !!blockquoteEl,
      fontSize,
      fontFamily,
      color,
      backgroundColor,
      align,
      canIndent: indentPx < INDENT_MAX_PX,
      canOutdent: indentPx > 0,
    };
  }

  /** Coalescing por rAF: como máximo un recálculo por frame (§5.3). */
  function refreshFormatState(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const sel = window.getSelection();
      if (!sel?.rangeCount || !editor?.contains(sel.anchorNode)) return;
      format = computeFormatState();
    });
  }

  // ─── Sincronización (E2/E3): punto único de estrangulamiento ──────────
  function syncValues(): void {
    // La canonicalización corre sobre una sonda desacoplada: NUNCA se
    // reescribe el HTML crudo sobre el DOM vivo mientras Squire lo gobierna.
    const rawHtml = sq ? sq.getHTML() : editor.innerHTML;
    const probe = editor.ownerDocument!.createElement('div');
    probe.innerHTML = rawHtml;
    normalizeComposedDom(probe, { convertLegacyTags: true });

    const nextText = editor.innerText
      .replaceAll('\u200B', ' ')
      .replaceAll('\u00a0', ' ')
      .replaceAll('\r\n', '\n');
    const isEmpty = !hasMeaningfulText(nextText);
    // El MutationObserver de Squire observa atributos en todo el subárbol:
    // un setAttribute con el mismo valor igual dispara mutación → input →
    // bucle infinito. Solo escribir cuando el flag cambia de verdad.
    const emptyFlag = String(isEmpty);
    if (editor.dataset.empty !== emptyFlag) editor.dataset.empty = emptyFlag;

    if (isEmpty) {
      text = '';
      html = '';
      lastLocalHtml = '';
      refreshFormatState(); // E3
      return;
    }
    text = nextText;
    html = probe.innerHTML; // forma canónica compartida con el servidor
    lastLocalHtml = html;
    saveSelection();
    refreshFormatState(); // E3
  }

  onMount(() => {
    let disposed = false;

    void (async () => {
      const { default: SquireCtor } = await import('squire-rte'); // chunk separado, nunca SSR
      if (disposed || !editor) return;

      sq = new SquireCtor(editor, {
        blockTag: 'DIV',
        // El bundle cliente no tiene DOMPurify: usamos nuestro propio
        // normalizador como sanitizador de entrada (mismo contrato que el
        // servidor).
        sanitizeToDOMFragment: (rawHtml: string) => {
          const container = document.createElement('div');
          container.innerHTML = rawHtml;
          normalizeComposedDom(container, { convertLegacyTags: true });
          const frag = document.createDocumentFragment();
          while (container.firstChild) frag.appendChild(container.firstChild);
          return frag;
        },
      });

      const initialHtml = html || plainTextToHtml(text);
      sq.setHTML(initialHtml);
      html = initialHtml;

      sq.addEventListener('input', () => syncValues());
      sq.addEventListener('select', () => {
        saveSelection();
        refreshFormatState();
      });
      sq.addEventListener('cursor', () => {
        saveSelection();
        refreshFormatState();
      });
      sq.addEventListener('pathChange', () => refreshFormatState());
      sq.addEventListener('willPaste', handleWillPaste);

      syncValues(); // [E4] sincroniza text con el html inicial ya normalizado
    })();

    const trackSelection = () => saveSelection();
    document.addEventListener('selectionchange', trackSelection);
    return () => {
      disposed = true;
      document.removeEventListener('selectionchange', trackSelection);
      if (rafId) cancelAnimationFrame(rafId);
      sq?.destroy();
      sq = null;
    };
  });

  $effect(() => {
    const externalHtml = html;
    const externalText = text;
    if (!editor || !sq) return;
    // Eco interno: si el html es exactamente el último que publicamos desde
    // syncValues, NO reescribir — setHTML reemplazaría el DOM y el caret
    // saltaría al inicio en cada tecla. Solo reaccionar a cambios externos
    // (borrador cargado, reset del padre, prefill de respuesta).
    if (externalHtml && externalHtml === lastLocalHtml) return;
    const nextHtml = externalHtml || plainTextToHtml(externalText);
    if (!nextHtml && !hasMeaningfulText(editor.innerText)) return;
    if (editor.innerHTML !== nextHtml) {
      sq.setHTML(nextHtml);
      syncValues(); // [R9] SIEMPRE dentro de este guard — evita el bucle
    }
  });
</script>

<div class="overflow-visible rounded-xl border border-input bg-background {className}">
  <!-- [T-22 — C11, diseño §15.6.2] {#if}, NO class:hidden: el desmontaje debe
       destruir el `open` de los ToolbarPopover hijos y remover sus listeners
       de <svelte:window> cuando la toolbar se colapsa (T-25/§15.6.3). -->
  {#if showToolbar}
    <RichTextToolbar {format} onaction={dispatch} onpreserveSelection={preserveSelection} />
  {/if}

  <div
    bind:this={editor}
    {id}
    class="rich-text-content w-full overflow-y-auto px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring {minHeightClass}"
    contenteditable="true"
    role="textbox"
    tabindex="0"
    aria-label="Mensaje"
    aria-multiline="true"
    data-placeholder={placeholder}
    oninput={syncValues}
    onkeyup={saveSelection}
    onmouseup={saveSelection}
    onfocus={saveSelection}
  ></div>
</div>

<style>
  /* Squire siempre deja un bloque vacío en el root, así que `:empty` jamás
     matchea: el placeholder se maneja con el gancho data-empty. El atributo
     se fija en tiempo de ejecución (dataset), fuera del análisis de
     plantilla del compilador: se declara :global para que el podado de CSS
     no lo marque como selector sin uso. */
  .rich-text-content:global([data-empty='true'])::before {
    content: attr(data-placeholder);
    color: var(--muted-foreground);
    pointer-events: none;
  }

  .rich-text-content :global(div),
  .rich-text-content :global(p) {
    min-height: 1.25em;
  }

  /* [E10] Afordancia visual de edición para las etiquetas nuevas. */
  .rich-text-content :global(ul) {
    list-style: disc;
    padding-left: 1.5em;
  }

  .rich-text-content :global(ol) {
    list-style: decimal;
    padding-left: 1.5em;
  }

  .rich-text-content :global(li) {
    margin: 0.15em 0;
  }

  .rich-text-content :global(blockquote) {
    margin-left: 0;
    border-left: 3px solid var(--border);
    padding-left: 0.75em;
    color: var(--muted-foreground);
  }

  .rich-text-content :global(a) {
    color: var(--primary);
    text-decoration: underline;
  }

  .rich-text-content :global(i),
  .rich-text-content :global(em) {
    font-style: italic;
  }

  .rich-text-content :global(u) {
    text-decoration: underline;
  }

  .rich-text-content :global(s) {
    text-decoration: line-through;
  }
</style>
