<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    label,
    pressed,
    expanded,
    hasPopup,
    disabled = false,
    tabindex = -1,
    onclick,
    onpreserveSelection,
    icon,
    class: className,
    element = $bindable(undefined),
    // [T-23 — RNF-08, diseño §15.5 detalle 3, §15.7] Desestructurada
    // explícitamente para que NO caiga en `{...rest}` (mitigación R19): si
    // cayera ahí terminaría como atributo DOM inválido en el <button> real.
    tooltipPlacement = 'bottom',
    ...rest
  }: {
    label: string;
    pressed?: boolean;
    expanded?: boolean;
    hasPopup?: 'dialog';
    disabled?: boolean;
    tabindex?: number;
    onclick?: (event: MouseEvent) => void;
    onpreserveSelection?: (event: MouseEvent) => void;
    icon: Snippet;
    class?: string;
    element?: HTMLButtonElement;
    tooltipPlacement?: 'bottom' | 'top';
    [key: string]: unknown;
  } = $props();

  const uid = $props.id();
  const tooltipId = `toolbar-tooltip-${uid}`;
</script>

<span class="group relative inline-flex">
  <button
    bind:this={element}
    type="button"
    {...rest}
    class={cn(
      'rounded-md p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
      pressed
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      className,
    )}
    aria-label={label}
    aria-pressed={pressed}
    aria-expanded={expanded}
    aria-haspopup={hasPopup}
    aria-describedby={tooltipId}
    {disabled}
    {tabindex}
    onmousedown={onpreserveSelection}
    {onclick}
  >
    {@render icon()}
  </button>
  <span
    id={tooltipId}
    role="tooltip"
    class={cn(
      'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
      tooltipPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
    )}
  >
    {label}
  </span>
</span>
