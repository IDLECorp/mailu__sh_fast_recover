<script lang="ts">
  import { buttonVariants } from './button-variants';
  import type { ButtonSize, ButtonVariant } from './button-variants';
  import type { Snippet } from 'svelte';

  let {
    variant = 'default',
    size = 'default',
    href,
    class: className,
    onclick,
    type = 'button',
    disabled = false,
    form,
    children
  }: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    href?: string;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    form?: string;
    children: Snippet;
  } = $props();
</script>

{#if href}
  <a {href} class={buttonVariants({ variant, size, class: className })}>
    {@render children?.()}
  </a>
{:else}
  <button {type} {disabled} {onclick} {form} class={buttonVariants({ variant, size, class: className })}>
    {@render children?.()}
  </button>
{/if}