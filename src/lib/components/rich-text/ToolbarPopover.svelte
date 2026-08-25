<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';
  import { cn } from '$lib/utils';
  import ToolbarButton from './ToolbarButton.svelte';

  let {
    label,
    icon,
    panel,
    disabled = false,
    tabindex = -1,
    onpreserveSelection,
    open = $bindable(false),
    // [T-24 — RNF-08, diseño §15.5 detalle 3, §15.7] Desestructuradas
    // explícitamente para que NO caigan en `{...rest}` sobre ToolbarButton
    // (mismo cuidado que T-23, mitigación R19).
    placement = 'bottom',
    align = 'start',
    viewportBounded = false,
    ...rest
  }: {
    label: string;
    icon: Snippet;
    panel: Snippet<[{ close: (restoreFocus?: boolean) => void }]>;
    disabled?: boolean;
    tabindex?: number;
    onpreserveSelection?: (event: MouseEvent) => void;
    open?: boolean;
    placement?: 'bottom' | 'top';
    align?: 'start' | 'end';
    viewportBounded?: boolean;
    [key: string]: unknown;
  } = $props();

  let triggerEl: HTMLButtonElement | undefined = $state();
  let containerEl: HTMLDivElement | undefined = $state();
  let panelEl: HTMLDivElement | undefined = $state();
  let panelPosition = $state('');

  function close(restoreFocus = true): void {
    if (!open) return;
    open = false;
    if (restoreFocus) triggerEl?.focus();
  }

  function positionPanel(): void {
    if (!viewportBounded || !triggerEl || !panelEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    const panel = panelEl.getBoundingClientRect();
    const desiredLeft = align === 'end' ? trigger.right - panel.width : trigger.left;
    const desiredTop = placement === 'top' ? trigger.top - panel.height - 4 : trigger.bottom + 4;
    const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - panel.width - 8));
    const top = Math.max(8, Math.min(desiredTop, window.innerHeight - panel.height - 8));
    panelPosition = `left: ${left}px; top: ${top}px`;
  }

  async function toggle(): Promise<void> {
    open = !open;
    if (open && viewportBounded) {
      await tick();
      positionPanel();
    }
  }

  function onWindowPointerDown(event: PointerEvent): void {
    if (!open || !containerEl) return;
    if (!containerEl.contains(event.target as Node)) close();
  }

  function onWindowKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window
  onpointerdown={onWindowPointerDown}
  onkeydown={onWindowKeydown}
  onresize={positionPanel}
/>

<div class="relative inline-flex" bind:this={containerEl}>
  <ToolbarButton
    bind:element={triggerEl}
    {label}
    {icon}
    {disabled}
    {tabindex}
    expanded={open}
    hasPopup="dialog"
    {onpreserveSelection}
    onclick={toggle}
    tooltipPlacement={placement}
    {...rest}
  />
  {#if open}
    <div
      bind:this={panelEl}
      role="dialog"
      aria-label={label}
      style={viewportBounded ? panelPosition : undefined}
      class={cn(
        'z-30 rounded-lg border bg-popover p-2 shadow-lg',
        viewportBounded
          ? 'fixed max-h-[calc(100vh-1rem)] overflow-y-auto'
          : [
              'absolute',
              placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
              align === 'end' ? 'right-0' : 'left-0',
            ],
      )}
    >
      {@render panel({ close })}
    </div>
  {/if}
</div>
