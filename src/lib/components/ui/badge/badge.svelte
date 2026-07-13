<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';
  import { type VariantProps, tv } from 'tailwind-variants';

  const badgeVariants = tv({
    base: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground'
      }
    },
    defaultVariants: { variant: 'default' }
  });

  type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

  let { class: className, variant = 'default', children, ...rest }: { class?: string; variant?: BadgeVariant; children: Snippet } & HTMLAttributes<HTMLSpanElement> = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)} {...rest}>
  {@render children?.()}
</span>