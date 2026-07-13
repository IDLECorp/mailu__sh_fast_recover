<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let { class: className, children, ...rest }: { class?: string; children: Snippet } & HTMLButtonAttributes = $props();
</script>

<button type="button" class={cn('inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...rest}>
  {@render children?.()}
</button>