<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  let {
    class: className,
    children,
    ...rest
  }: { class?: string; children: Snippet } & HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p class={cn('text-sm text-gray-600', className)} {...rest}>
  {@render children?.()}
</p>
