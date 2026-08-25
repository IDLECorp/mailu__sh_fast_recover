<script lang="ts">
  import { onMount } from 'svelte';
  import { BriefcaseBusiness, Clock3, Hand, Heart, Search, Shapes, Smile } from 'lucide-svelte';
  import {
    EMOJI_CATEGORIES,
    EMOJI_ENTRIES,
    emojisByCategory,
    searchEmojis,
    type EmojiEntry,
  } from '$lib/emoji-data';
  import { cn } from '$lib/utils';

  let {
    onselect,
    recent = $bindable<string[]>([]),
  }: {
    /** Emite el carácter Unicode del emoji elegido. Nunca innerHTML (CA-15). */
    onselect: (emoji: string) => void;
    recent?: string[];
  } = $props();

  const RECENT_LIMIT = 16;
  const uid = $props.id();
  const categoryPanelId = `emoji-category-panel-${uid}`;

  let query = $state('');
  let activeCategory = $state(EMOJI_CATEGORIES[0].id);
  let searchInput = $state<HTMLInputElement | undefined>();

  // Renderiza SOLO la categoría activa o los resultados de búsqueda —
  // nunca las 5 categorías completas a la vez (mitigación R14/RNF-06).
  let visibleEntries = $derived(
    query.trim() ? searchEmojis(query) : emojisByCategory(activeCategory),
  );

  let activeCategoryLabel = $derived(
    EMOJI_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? 'Emojis',
  );

  function selectCategory(categoryId: string): void {
    activeCategory = categoryId;
    query = '';
  }

  function selectEmoji(entry: EmojiEntry): void {
    recent = [entry.char, ...recent.filter((char) => char !== entry.char)].slice(0, RECENT_LIMIT);
    onselect(entry.char);
  }

  function emojiLabel(char: string): string {
    return EMOJI_ENTRIES.find((entry) => entry.char === char)?.keywords[0] ?? char;
  }

  function handleCategoryKeydown(
    event: KeyboardEvent & { currentTarget: HTMLButtonElement },
  ): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;

    event.preventDefault();
    tabs[nextIndex]?.click();
    tabs[nextIndex]?.focus();
  }

  onMount(() => searchInput?.focus());
</script>

<div class="flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2 p-1">
  <label class="relative block">
    <Search
      class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <span class="sr-only">Buscar emoji</span>
    <input
      bind:this={searchInput}
      type="search"
      bind:value={query}
      placeholder="Buscar"
      aria-label="Buscar emoji"
      class="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  </label>

  <div
    class="flex items-center justify-between border-b border-border px-1"
    role="tablist"
    aria-label="Categorías de emoji"
  >
    {#each EMOJI_CATEGORIES as category (category.id)}
      <button
        id={`emoji-category-tab-${uid}-${category.id}`}
        type="button"
        role="tab"
        aria-label={category.label}
        aria-selected={activeCategory === category.id}
        aria-controls={categoryPanelId}
        tabindex={activeCategory === category.id ? 0 : -1}
        title={category.label}
        onclick={() => selectCategory(category.id)}
        onkeydown={handleCategoryKeydown}
        class={cn(
          'relative flex size-9 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          activeCategory === category.id
            ? 'bg-primary/10 text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {#if category.id === 'caras'}
          <Smile class="size-4.5" aria-hidden="true" />
        {:else if category.id === 'gestos'}
          <Hand class="size-4.5" aria-hidden="true" />
        {:else if category.id === 'afecto'}
          <Heart class="size-4.5" aria-hidden="true" />
        {:else if category.id === 'oficina'}
          <BriefcaseBusiness class="size-4.5" aria-hidden="true" />
        {:else}
          <Shapes class="size-4.5" aria-hidden="true" />
        {/if}
      </button>
    {/each}
  </div>

  <div
    id={categoryPanelId}
    class="emoji-scrollbar max-h-64 overflow-y-auto pr-1"
    role={query.trim() ? 'region' : 'tabpanel'}
    aria-label={query.trim() ? 'Resultados de búsqueda' : activeCategoryLabel}
    aria-labelledby={query.trim() ? undefined : `emoji-category-tab-${uid}-${activeCategory}`}
  >
    {#if !query.trim()}
      <section aria-labelledby={`recent-emojis-${uid}`}>
        <h2
          id={`recent-emojis-${uid}`}
          class="mb-1 flex items-center gap-1.5 px-1 pt-1 text-xs font-medium text-muted-foreground"
        >
          <Clock3 class="size-3.5" aria-hidden="true" />
          Usados recientemente
        </h2>
        {#if recent.length === 0}
          <p class="mb-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Todavía no usaste emojis.
          </p>
        {:else}
          <div class="mb-2 grid grid-cols-7 gap-1" role="group" aria-label="Usados recientemente">
            {#each recent as char (char)}
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-md text-xl transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={emojiLabel(char)}
                onclick={() => {
                  const entry = EMOJI_ENTRIES.find((candidate) => candidate.char === char);
                  if (entry) selectEmoji(entry);
                }}
              >
                {char}
              </button>
            {/each}
          </div>
        {/if}
      </section>
      <h2 class="mb-1 px-1 text-xs font-medium text-muted-foreground">{activeCategoryLabel}</h2>
    {/if}

    <div
      class="grid grid-cols-7 gap-1"
      role="group"
      aria-label={query.trim() ? 'Resultados' : activeCategoryLabel}
    >
      {#each visibleEntries as entry (entry.char)}
        <button
          type="button"
          class="flex size-9 items-center justify-center rounded-md text-xl transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={entry.keywords[0] ?? entry.char}
          onclick={() => selectEmoji(entry)}
        >
          {entry.char}
        </button>
      {/each}
      {#if visibleEntries.length === 0}
        <p class="col-span-7 py-6 text-center text-xs text-muted-foreground">Sin resultados</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .emoji-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklab, var(--muted-foreground) 45%, transparent) transparent;
    overscroll-behavior: contain;
  }

  .emoji-scrollbar::-webkit-scrollbar {
    width: 7px;
  }

  .emoji-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .emoji-scrollbar::-webkit-scrollbar-thumb {
    border: 1px solid transparent;
    border-radius: 999px;
    background: color-mix(in oklab, var(--muted-foreground) 38%, transparent);
    background-clip: padding-box;
  }

  .emoji-scrollbar::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--primary) 55%, transparent);
    background-clip: padding-box;
  }

  .emoji-scrollbar::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
</style>
