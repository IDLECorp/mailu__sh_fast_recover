<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';
  import Toast from '$lib/components/Toast.svelte';

  let { children }: { data: LayoutData; children: Snippet } = $props();
</script>

{@render children?.()}

<Toast />