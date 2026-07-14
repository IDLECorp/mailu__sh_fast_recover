<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let {
    class: className,
    value = $bindable(''),
    children,
    ...rest
  }: { class?: string; value?: string; children?: Snippet } & HTMLInputAttributes = $props();
</script>

{#if children}
  {@render children?.()}
{:else}
  <input
    bind:value
    class={cn(
      'h-12 w-full focus:outline-0 focus:border-none disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...rest}
  />
{/if}
