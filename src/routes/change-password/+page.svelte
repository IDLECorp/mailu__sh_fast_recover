<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { KeyRound, Eye, EyeOff, AlertCircle, Loader2, ShieldAlert } from 'lucide-svelte';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);
  let showCurrent = $state(false);
  let showNew = $state(false);
  let showConfirm = $state(false);
</script>

<svelte:head><title>Cambiar contraseña · Fast Mail</title></svelte:head>

<main class="min-h-screen flex items-center justify-center px-4 py-10">
  <div class="w-full max-w-md space-y-4">
  
      <div class="flex flex-col items-center text-center space-y-2 mb-2">
        <div class="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
          <ShieldAlert class="size-6" />
        </div>
        <h1 class="text-xl font-semibold tracking-tight">Cambiar contraseña</h1>
        <p class="text-sm text-muted-foreground px-6">
          Tu cuenta <span class="font-medium">{data.email}</span> tiene una contraseña temporal. Necesitás cambiarla antes de usar Fast Mail.
        </p>
      </div>

      <Card>
        <CardContent class="p-5">
          <form
            method="POST"
            use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}
            class="space-y-4"
          >
            <div class="space-y-1.5">
              <Label for="current">Contraseña actual</Label>
              <div class="relative">
                <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="current" name="current"
                  type={showCurrent ? 'text' : 'password'}
                  autocomplete="current-password"
                  required
                  class="pl-9 pr-9"
                  placeholder="Contraseña temporal"
                />
                <button type="button" onclick={() => (showCurrent = !showCurrent)} class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition" aria-label={showCurrent ? 'Ocultar' : 'Mostrar'}>
                  {#if showCurrent}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="new">Nueva contraseña</Label>
              <div class="relative">
                <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input id="new" name="new" type={showNew ? 'text' : 'password'} autocomplete="new-password" required minlength={8} class="pl-9 pr-9" placeholder="Nueva contraseña (mín. 8 caracteres)" />
                <button type="button" onclick={() => (showNew = !showNew)} class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition" aria-label={showNew ? 'Ocultar' : 'Mostrar'}>
                  {#if showNew}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="confirm">Confirmar nueva contraseña</Label>
              <div class="relative">
                <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input id="confirm" name="confirm" type={showConfirm ? 'text' : 'password'} autocomplete="new-password" required minlength={8} class="pl-9 pr-9" placeholder="Repetí la nueva contraseña" />
                <button type="button" onclick={() => (showConfirm = !showConfirm)} class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition" aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}>
                  {#if showConfirm}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
                </button>
              </div>
            </div>

            {#if form?.error}
              <p class="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle class="size-4 shrink-0" />{form.error}
              </p>
            {/if}

            <Button type="submit" size="lg" disabled={loading} class="w-full">
              {#if loading}<Loader2 class="size-4 animate-spin" /> Cambiando…{:else}Cambiar contraseña{/if}
            </Button>
          </form>
        </CardContent>
      </Card>

      <form method="POST" action="/logout" class="text-center">
        <Button type="submit" variant="link" size="sm">Cancelar sesión</Button>
      </form>
  </div>
</main>
