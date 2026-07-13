<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
  <title>Fast Mail</title>
</svelte:head>

<div class="min-h-screen bg-fast-bg text-fast-text">
  {@render children?.()}
</div>