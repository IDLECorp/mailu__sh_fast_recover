<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-svelte';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);

  const next = $derived(data.next ?? '/inbox');

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
</script>

<svelte:head>
  <title>Iniciar sesión · Fast Mail</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center px-4 py-10">
  <div class="w-full max-w-sm space-y-6">
    <div class="flex flex-col items-center text-center space-y-2">
      <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <Mail class="size-6" />
      </div>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Fast Mail</h1>
        <p class="text-sm text-muted-foreground">Acceso a tu correo SH Fast Recover</p>
      </div>
    </div>

    <Card>
      <CardHeader class="space-y-1">
        <CardTitle class="text-lg">Bienvenido</CardTitle>
        <CardDescription>Ingresá con tu cuenta de correo corporativa</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="POST"
          use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}
          class="space-y-4"
        >
          <input type="hidden" name="next" value={next} />

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                name="email"
                type="email"
                autocomplete="username"
                required
                bind:value={email}
                placeholder="nombre@shfastrecover.com"
                class="pl-9"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="password">Contraseña</Label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                required
                bind:value={password}
                class="pl-9 pr-9"
              />
              <button type="button" onclick={() => (showPassword = !showPassword)} class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition" aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
                {#if showPassword}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
              </button>
            </div>
          </div>

          {#if form?.error}
            <p class="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle class="size-4 shrink-0" />
              {form.error}
            </p>
          {/if}

          <Button type="submit" size="lg" disabled={loading} class="w-full">
            {#if loading}
              <Loader2 class="size-4 animate-spin" /> Entrando…
            {:else}
              Entrar <ArrowRight class="size-4" />
            {/if}
          </Button>
        </form>
      </CardContent>
    </Card>

    <p class="text-center text-xs text-muted-foreground">
      Mailu · <span class="font-medium">SH Fast Recover</span>
    </p>
  </div>
</main>