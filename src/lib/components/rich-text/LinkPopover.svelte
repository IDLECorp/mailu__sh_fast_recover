<script lang="ts">
  import { normalizeUserLinkInput } from '$lib/compose-format';

  let {
    // NOTA (judgment call, T-07/T-09): el contrato exacto de props de
    // RichTextToolbar (diseño §3.5) solo expone `format`/`onaction`/
    // `onpreserveSelection` — no hay ningún campo que indique si la
    // selección del editor está colapsada. Como RichTextToolbar no tiene
    // forma de conocer ese estado, este prop se recibe con default `true`
    // (mostrar siempre el campo de texto) y NUNCA se usa para exigirlo: la
    // decisión real de si `textIfEmpty` se usa o se descarta ocurre en
    // `dispatch({kind:'link', ...})` dentro de RichTextEditor.svelte (T-10),
    // que sí conoce el estado real de la selección en el momento de insertar.
    collapsedSelection = true,
    onsubmit,
  }: {
    /** true si el caret está colapsado (sin selección): se pide también el texto del vínculo. */
    collapsedSelection?: boolean;
    /**
     * Envía la acción al padre (que la reenvía a `dispatch({kind:'link', ...})`
     * en RichTextEditor.svelte, T-10). Devuelve `true` si la inserción tuvo
     * éxito (el popover se cierra) o `false` si falló (se mantiene abierto y
     * se muestra el mensaje de error de inserción, diseño §4.2.3/§10.2).
     */
    onsubmit: (payload: { href: string; textIfEmpty: string }) => boolean;
  } = $props();

  let urlValue = $state('');
  let textValue = $state('');
  let insertFailed = $state(false);

  let normalizedHref = $derived(urlValue.trim() ? normalizeUserLinkInput(urlValue) : null);
  let showValidationError = $derived(urlValue.trim().length > 0 && normalizedHref === null);
  // El texto es siempre opcional en esta capa: si la selección real no está
  // colapsada, RichTextEditor.dispatch() ignora textIfEmpty y usa el texto
  // seleccionado; si está colapsada y el usuario no escribió texto, dispatch
  // usa el propio href como texto visible (ver T-10).
  let canSubmit = $derived(normalizedHref !== null);

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    if (!canSubmit || !normalizedHref) return;
    insertFailed = false;
    const ok = onsubmit({ href: normalizedHref, textIfEmpty: textValue.trim() });
    if (!ok) insertFailed = true;
  }
</script>

<form class="flex w-64 flex-col gap-2 p-1" onsubmit={handleSubmit}>
  <label class="flex flex-col gap-1 text-xs text-muted-foreground">
    URL
    <input
      type="text"
      bind:value={urlValue}
      placeholder="https://ejemplo.com"
      class="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-invalid={showValidationError}
    />
  </label>

  {#if collapsedSelection}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">
      Texto
      <input
        type="text"
        bind:value={textValue}
        placeholder="Texto del vínculo"
        class="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  {/if}

  {#if showValidationError}
    <p class="text-xs text-destructive">Ingresá una URL válida (http, https o mailto).</p>
  {/if}
  {#if insertFailed}
    <p class="text-xs text-destructive">No se pudo insertar el vínculo.</p>
  {/if}

  <button
    type="submit"
    disabled={!canSubmit}
    class="mt-1 h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
  >
    Insertar
  </button>
</form>
