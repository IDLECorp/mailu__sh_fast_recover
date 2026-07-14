<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import {
    Users,
    Plus,
    Trash2,
    AlertCircle,
    Loader2,
    ShieldAlert,
    ExternalLink,
  } from 'lucide-svelte';
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
  } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Avatar } from '$lib/components/ui/avatar';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let loading = $state(false);
  let loadingDelete = $state<string | null>(null);

  let localpart = $state('');
  let domain = $state(data.currentDomain);
  let password = $state('');
  let quota = $state('');
  void data;
</script>

<svelte:head><title>Admin · Fast Mail</title></svelte:head>

<div class="flex h-full flex-col pt-4">
  <div class="bg-card px-4 py-3 sm:px-6 flex items-center gap-2">
    <Users class="size-4 text-primary" />
    <h1 class="text-sm font-semibold">Administración</h1>
    <span class="text-xs text-muted-foreground">· {data.currentDomain}</span>
  </div>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
      {#if !data.adminEnabled}
        <Card>
          <CardContent class="p-6">
            <div class="flex items-start gap-3">
              <ShieldAlert class="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div class="space-y-2">
                <h2 class="text-sm font-medium">Admin REST deshabilitado</h2>
                <p class="text-sm text-muted-foreground max-w-prose">
                  La REST API de Mailu está apagada (<code
                    class="text-xs bg-muted px-1.5 py-0.5 rounded">API=false</code
                  >
                  en <code class="text-xs bg-muted px-1.5 py-0.5 rounded">/mailu/mailu.env</code>).
                  Para gestionar usuarios desde acá: habilitá
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded">API=true</code>
                  y <code class="text-xs bg-muted px-1.5 py-0.5 rounded">API_TOKEN=...</code> en
                  Mailu, reiniciá, y configurá
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded">MAILU_API_KEY</code>
                  en el <code class="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> de Fast.
                </p>
                <a
                  href="https://mail.nexuscorpec.com/admin"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir admin de Mailu <ExternalLink class="size-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      {:else}
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Crear usuario</CardTitle>
            <CardDescription>Dar de alta una nueva cuenta de correo</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              method="POST"
              action="?/createUser"
              use:enhance={() => {
                loading = true;
                return async ({ update }) => {
                  loading = false;
                  await update();
                };
              }}
              class="grid sm:grid-cols-4 gap-3"
            >
              <div class="space-y-1.5">
                <Label for="localpart">Nombre</Label>
                <Input
                  id="localpart"
                  name="localpart"
                  placeholder="nombre"
                  required
                  bind:value={localpart}
                />
              </div>
              <div class="space-y-1.5">
                <Label for="domain">Dominio</Label>
                <select
                  id="domain"
                  name="domain"
                  bind:value={domain}
                  class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {#each data.domains as d}
                    <option value={d.name}>{d.name}</option>
                  {/each}
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="mín 8 caracteres"
                  required
                  bind:value={password}
                />
              </div>
              <div class="space-y-1.5">
                <Label for="quota">Cuota (MB)</Label>
                <div class="flex gap-2">
                  <Input
                    id="quota"
                    name="quota"
                    type="number"
                    placeholder="opcional"
                    bind:value={quota}
                  />
                  <Button type="submit" disabled={loading}>
                    {#if loading}<Loader2 class="size-4 animate-spin" />{:else}<Plus
                        class="size-4"
                      />{/if}
                  </Button>
                </div>
              </div>
            </form>
            {#if form?.error}
              <p class="mt-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle class="size-4 shrink-0" />{form.error}
              </p>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base"
              >Usuarios <Badge variant="secondary" class="ml-1">{data.users.length}</Badge
              ></CardTitle
            >
          </CardHeader>
          <CardContent class="p-0">
            <ul class="divide-y">
              {#each data.users as u}
                <li class="flex items-center gap-3 px-6 py-3">
                  <Avatar
                    alt={u.email}
                    fallback={u.email.slice(0, 2).toUpperCase()}
                    class="size-8 border"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm truncate" class:opacity-50={!u.enabled}>{u.email}</p>
                    <p class="text-xs text-muted-foreground">
                      dominio: {u.domain}{#if u.quota}
                        · cuota: {u.quota}MB{/if}
                    </p>
                  </div>
                  <form
                    method="POST"
                    action="?/deleteUser"
                    use:enhance={() => {
                      loadingDelete = u.email;
                      return async ({ update }) => {
                        loadingDelete = null;
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="email" value={u.email} />
                    <button
                      type="submit"
                      disabled={loadingDelete === u.email}
                      aria-label="Eliminar"
                      class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition disabled:opacity-50"
                    >
                      {#if loadingDelete === u.email}<Loader2
                          class="size-4 animate-spin"
                        />{:else}<Trash2 class="size-4" />{/if}
                    </button>
                  </form>
                </li>
              {/each}
            </ul>
          </CardContent>
        </Card>
      {/if}
    </div>
  </div>
</div>
