<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let {
    class: className,
    src,
    alt,
    fallback = 'U',
    children,
    ...rest
  }: {
    class?: string;
    src?: string;
    alt?: string;
    fallback?: string;
    children?: Snippet;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let errored = $state(false);
  const initials = $derived((alt ?? fallback).slice(0, 2).toUpperCase());
</script>

<div class={cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground', className)} {...rest}>
  {#if src && !errored}
    <img {src} {alt} class="aspect-square h-full w-full object-cover" onerror={() => (errored = true)} />
  {:else}
    {initials}
  {/if}
  {#if children}{@render children?.()}{/if}
</div>