# Informe Técnico — 14 de Julio 2026

**Autor:** Steven & Cristina  
**Proyecto:** fast-emails / Mailu / `mail.shfastrecover.com`  
**VPS:** Hostinger — AlmaLinux 9 — `2a02:4780:75:1d76::1`  
**Repositorio:** https://github.com/IDLECorp/mailu__sh_fast_recover  

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Problema 1: Redis ENOTFOUND mailu-redis-1](#2-problema-1-redis-enotfound-mailu-redis-1)
3. [Problema 2: CI/CD Runner colgado (job en queue)](#3-problema-2-cicd-runner-colgado-job-en-queue)
4. [Problema 3: Correos a sistema@shfastrecover.com rebotados](#4-problema-3-correos-a-sistemashfastrecovercom-rebotados)
5. [Problema 4: Mailu Admin API 404 (rutas sin /api/v1/)](#5-problema-4-mailu-admin-api-404-rutas-sin-apiv1)
6. [Problema 5: Cambio de contraseña falla con "no se pudo cambiar"](#6-problema-5-cambio-de-contrasena-falla-con-no-se-pudo-cambiar)
7. [Problema 6: Gateway Timeout — Coolify Split Brain](#7-problema-6-gateway-timeout--coolify-split-brain)
8. [Archivos Modificados](#8-archivos-modificados)
9. [Comandos Útiles](#9-comandos-utiles)

---

## 1. Resumen Ejecutivo

Durante la sesión del 14 de julio de 2026 se identificaron y resolvieron **6 incidentes** en el entorno de producción de `mail.shfastrecover.com`. La mayoría fueron problemas de configuración entre Docker, Traefik, Mailu y el runner de GitHub Actions. Al finalizar, el sitio quedó operativo, los deploys automáticos funcionando y la API de Mailu respondiendo correctamente.

---

## 2. Problema 1: Redis ENOTFOUND mailu-redis-1

### Síntoma
```text
redis error getaddrinfo ENOTFOUND mailu-redis-1
redis ping failed Reached the max retries per request limit
```

### Causa
El archivo `.env.local` no definía `REDIS_URL`, y el código en `src/lib/server/redis.ts:3` usaba un default:
```ts
const REDIS_URL = env.REDIS_URL ?? 'redis://mailu-redis-1:6379/1';
```
`mailu-redis-1` es un nombre de contenedor Docker que solo se resuelve dentro de la red Docker del VPS. Desde la máquina local no existe registro DNS → `ENOTFOUND`.

### Solución
Se modificó `src/lib/server/redis.ts` para que:
- Si `REDIS_URL` no está definido, `pingRedis()` retorne `false` sin intentar conectar
- `redisClient()` retorne `null` si no hay URL configurada
- El sistema de sesiones (`auth.ts`) ya tenía un fallback en memoria, por lo que la funcionalidad no se pierde

**Archivo modificado:** `src/lib/server/redis.ts`

---

## 3. Problema 2: CI/CD Runner colgado (job en queue)

### Síntoma
GitHub Actions mostraba el job como **"queued"** por más de 3 minutos:
```
Waiting for a runner to pick up this job...
```
El runner `vps-prod-runner-fast` aparecía como **online** y **not busy** en la API de GitHub, pero no tomaba los jobs.

### Causa
El proceso `Runner.Listener` estaba vivo pero con una conexión stale al message broker de GitHub. No procesaba mensajes nuevos aunque seguía refrescando credenciales.

### Solución
```bash
# Matar procesos stale
pkill -f 'actions-runner-fast'

# Reiniciar el runner
cd /home/docker-steven/actions-runner-fast
nohup ./run.sh &> runner.log &
```
El runner reconectó y tomó el job inmediatamente.

### Recomendación
Instalar como servicio systemd (requiere sudo):
```bash
cd /home/docker-steven/actions-runner-fast
sudo ./svc.sh install docker-steven
sudo ./svc.sh start
```

---

## 4. Problema 3: Correos a sistema@shfastrecover.com rebotados

### Síntoma
Emails enviados desde Gmail a `sistema@shfastrecover.com` eran rechazados:
```
550 5.1.1 <sistema@shfastrecover.com>: Recipient address rejected: User unknown
```

### Causa
El usuario en Mailu es `sistemas@shfastrecover.com` **(con 's')**, pero el remitente escribió `sistema@shfastrecover.com` **(sin 's')**. Al no existir el usuario, Postfix rechaza el correo.

### Diagnóstico
```bash
# Verificar usuario (API de Mailu)
curl -s -H 'Authorization: Bearer <token>' \
  http://localhost:8080/api/v1/user/sistema@shfastrecover.com
# → 404 User cannot be found

curl -s -H 'Authorization: Bearer <token>' \
  http://localhost:8080/api/v1/user/sistemas@shfastrecover.com
# → 200 datos del usuario
```

### Solución Propendiente
Crear un **alias** en Mailu para que `sistema@shfastrecover.com` → `sistemas@shfastrecover.com`:
```bash
docker exec mailu-admin-1 flask mailu alias sistema shfastrecover.com sistemas@shfastrecover.com
```
*(Pendiente de ejecutar si el usuario lo confirma)*

---

## 5. Problema 4: Mailu Admin API 404 (rutas sin /api/v1/)

### Síntoma
```text
Mailu Admin /user/sistemas%40shfastrecover.com -> 404 Not Found
```

### Causa
La API de Mailu en el contenedor `mailu-admin-1` sirve los endpoints bajo el prefijo `/api/v1/`. El código en `mailu-admin.ts` llamaba a rutas como `/user`, `/domain`, etc. **sin el prefijo**.

Rutas reales de la API:
```text
GET    /api/v1/domain                  → Listar dominios
GET    /api/v1/user                    → Listar usuarios
GET    /api/v1/user/<email>            → Obtener usuario
PATCH  /api/v1/user/<email>            → Actualizar usuario
DELETE /api/v1/user/<email>            → Eliminar usuario
POST   /api/v1/user                    → Crear usuario
```

### Solución
Se agregó una función helper `api()` que antepone `/api/v1/` a todas las rutas:
```ts
function api(path: string): string {
  return `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}
```

Todas las funciones (`listDomains`, `listUsers`, `createUser`, `deleteUser`, `updatePassword`, etc.) ahora usan `api('/user')` en lugar de `'/user'`.

**Archivo modificado:** `src/lib/server/mailu-admin.ts`

---

## 6. Problema 5: Cambio de contraseña falla con "no se pudo cambiar"

### Síntoma
Al intentar cambiar la contraseña desde la UI, aparecía el mensaje:  
**"no se pudo cambiar"**

### Causa
En SvelteKit v2, la función `redirect()` lanza un objeto de la clase `Redirect` que **NO extiende `Error`**. El código atrapaba toda excepción en un `try-catch`:

```ts
try {
  await updatePassword(...);
  throw redirect(303, '/inbox');
} catch (e) {
  if (e instanceof Error && e.message === 'redirect') throw e;
  //                ↑ NUNCA se cumple porque Redirect no es Error
  const msg = (e as Error).message || 'no se pudo cambiar';
  return fail(500, { error: msg });
  //                          ↑ msg es undefined → 'no se pudo cambiar'
}
```

Como `Redirect` no es `instanceof Error`, la condición fallaba y se ejecutaba el `fail(500, { error: 'no se pudo cambiar' })`.

### Solución
Se movió `throw redirect()` fuera del `try-catch`:

```ts
try {
  await updatePassword(locals.user.email, newPw);
  if (sid) await clearSessionNeedPwChange(sid);
} catch (e) {
  const msg = (e as Error).message || 'no se pudo cambiar';
  return fail(500, { error: msg });
}
throw redirect(303, '/inbox');
```

**Archivo modificado:** `src/routes/change-password/+page.server.ts`

---

## 7. Problema 6: Gateway Timeout — Coolify Split Brain

### Síntoma
`mail.shfastrecover.com` dejó de responder (Gateway Timeout). Los otros dominios (`nexuscorpec.com`, `idec.ec`) funcionaban normal.

### Causa
Había **dos contenedores** con labels de Traefik para el mismo dominio `shfastrecover.com`:

| Contenedor | Origen | Estado |
|---|---|---|
| `fast-mails` | GitHub Actions (deploy manual) | ✅ Recién deployado |
| `auvzh0dhnlynmp2kupf65838-185544736980` | Coolify (auto-deploy) | ❌ Build obsoleto |

Traefik balanceaba o ruteaba al contenedor de Coolify, que tenía un build anterior sin los fixes. Esto es el **Coolify Split Brain** documentado en la sección 10.8 del informe `docker-nexus-idec.md`.

### Solución
```bash
docker stop auvzh0dhnlynmp2kupf65838-185544736980
docker rm auvzh0dhnlynmp2kupf65838-185544736980
docker restart coolify-proxy
```

Se verificó que `mail.shfastrecover.com` responde:
```text
HTTP/2 303
location: /login?next=%2F
```

---

## 8. Archivos Modificados

| Archivo | Cambio | Commit |
|---|---|---|
| `src/lib/server/redis.ts` | Redis opcional si no hay `REDIS_URL` | `cad7012` (previo) |
| `src/lib/server/mailu-admin.ts` | Prefijo `/api/v1/` en rutas API | `4532f6b` |
| `src/routes/change-password/+page.server.ts` | `redirect()` fuera del `try-catch` | `66bb090` |

---

## 9. Comandos Útiles

### Ver estado de contenedores
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

### Logs de fast-mails
```bash
docker logs --tail 50 fast-mails
```

### Verificar API de Mailu
```bash
docker exec mailu-admin-1 curl -s \
  -H 'Authorization: Bearer <API_TOKEN>' \
  http://localhost:8080/api/v1/user/sistemas@shfastrecover.com
```

### Crear alias en Mailu
```bash
docker exec mailu-admin-1 flask mailu alias <localpart> <dominio> <destino>
# Ej: docker exec mailu-admin-1 flask mailu alias sistema shfastrecover.com sistemas@shfastrecover.com
```

### Eliminar contenedor conflictivo de Coolify
```bash
docker ps --format '{{.Names}} {{.Labels}}' | grep 'shfastrecover\|idec\|nexus'
docker stop <nombre-contenedor>
docker rm <nombre-contenedor>
```

### Reiniciar runner
```bash
cd /home/docker-steven/actions-runner-fast
pkill -f 'actions-runner-fast'
nohup ./run.sh &> runner.log &
```

---

*Documento generado el 14 de julio de 2026 durante la sesión de troubleshooting con Steven y Cristina.*
