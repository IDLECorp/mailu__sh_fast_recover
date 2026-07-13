<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let { class: className, orientation = 'horizontal', children, ...rest }: { class?: string; orientation?: 'horizontal' | 'vertical'; children?: Snippet } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div role="separator" class={cn('shrink-0 bg-border', orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full', className)} {...rest}>
  {@render children?.()}
</div>