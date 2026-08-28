<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-svelte';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { toast } from '$lib/stores/toast';
  import './login.css';

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

<main class="h-dvh relative flex">
  <div class="absolute z-50 top-8 left-8">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width={2}
      stroke="#fff"
      class="size-8"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
      />
    </svg>
  </div>

  <div class="container flex-1 flex flex-col items-center justify-center">
    <div class="px-20">
      <div>
        <h2 class="text-5xl text-white font-semibold">Bienvenido!</h2>
        <span class="text-white text-4xl font-semibold">Empecemos a mensajear</span>
      </div>
      <p class="text-gray-300 pt-8">
        Inicia sesión para conectar con el mundo, compartir tus ideas y mantenerte en comunicación
        constante con todos tus amigos hoy.
      </p>
    </div>
  </div>

  <div class="flex-1 flex items-center justify-center py-10">
    <Card class="px-20">
      <h3 class="text-2xl font-semibold text-center pb-8">Fast Mail</h3>
      <CardHeader class="space-y-1">
        <CardTitle class="text-lg font-medium">Bienvenido</CardTitle>
        <CardDescription class="text-gray-500 pb-6"
          >Si tienes problemas para ingresar comunicate con el departamento de sistemas. <span
            class="underline text-black">Comunicate ahora.</span
          ></CardDescription
        >
      </CardHeader>
      <CardContent>
        <form
          method="POST"
          use:enhance={() => {
            loading = true;
            return async ({ result, update }) => {
              loading = false;
              await update();
              if (result.type === 'failure') {
                const msg =
                  (result.data as { error?: string })?.error ??
                  'No pudimos entrar. Revisá tus datos.';
                toast.error(msg);
              }
            };
          }}
          class="space-y-8"
        >
          <input
            class="focus:bg-gray-600 bg-transparent border-b focus:border-2"
            type="hidden"
            name="next"
            value={next}
          />

          <div class="space-y-2">
            <div class="relative border rounded-3xl flex items-center px-8">
              <Mail class="w-4 h-4" />
              <Input
                id="email"
                name="email"
                type="email"
                autocomplete="username"
                required
                bind:value={email}
                placeholder="correo@shfastrecover.com"
                class="pl-9"
              />
            </div>
          </div>

          <div class="space-y-2 pb-8">
            <div class="relative border rounded-3xl flex items-center px-8">
              <Lock class="w-4 h-4" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                placeholder="Introduce tu contraseña"
                required
                bind:value={password}
                class="pl-9 pr-9"
              />
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                class="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition"
                aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
              >
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

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            class="w-full h-12 rounded-3xl flex items-center justify-center"
          >
            {#if loading}
              <Loader2 class="size-4 animate-spin" /> Entrando…
            {:else}
              Entrar <ArrowRight class="size-4" />
            {/if}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</main>
