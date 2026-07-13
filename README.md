# Fast Mail

UI y backend TypeScript para acceder a correo Mailu sobre el dominio `mail.fastrecover.com`. Reemplaza el Webmail Roundcube y el Admin Flask solo para fastrecover con una identidad visual propia.

> Requisito: Mailu ya corriendo en el VPS y `mail.fastrecover.com` agregado a `HOSTNAMES` de Mailu. No reemplaza el servidor SMTP/IMAP; habla con Mailu por DNS interno de Docker.

## Stack

- **SvelteKit 5** (runes) + `adapter-node` — SSR en un solo contenedor Node.
- **Tailwind CSS 4** + **Bits UI** — identidad visual distinta a Nexus/IDEC.
- **imapflow** — IMAP (`mailu-imap-1:143`).
- **nodemailer** — SMTP submission (`mailu-smtp-1:587`).
- **Mailu Admin REST API** — gestión de dominios/usuarios (`mailu-admin-1:80`, header `X-Api-Key`).
- **node:20-alpine** multi-stage, mismo patrón que `nexus-admin`.

## Arquitectura

```
Internet → Traefik (coolify-proxy) ─ HTTPS mail.fastrecover.com ─ fast-mails:3000
                                                                     │
                                     red `mailu_default` (Docker ext)─┼─ mailu-imap-1:143
                                                                     ├─ mailu-smtp-1:587
                                                                     └─ mailu-admin-1:80   (X-Api-Key)
```

El container está en **dos redes externas**:
- `coolify` → Traefik HTTPS público (mismo reverse proxy que idec-web/nexus-admin).
- `mailu_default` → acceso interno a IMAP/SMTP/Admin sin exponer puertos ni pasar por Traefik.

## Estructura

```
fast-emails/
├── src/
│   ├── hooks.server.ts            # auth middleware (session HMAC-signed)
│   ├── routes/
│   │   ├── login/                 # login IMAP (no guarda password en cookie, en memoria del server)
│   │   ├── logout/                # POST destruye sesión
│   │   ├── inbox/                 # listado IMAP paginado, mark read, delete
│   │   ├── compose/               # envío SMTP
│   │   ├── admin/                 # CRUD usuarios/dominios vía Mailu Admin REST
│   │   └── health/                # /health (Docker + Traefik probe)
│   ├── lib/server/
│   │   ├── imap.ts                # imapflow
│   │   ├── smtp.ts                # nodemailer
│   │   ├── mailu-admin.ts         # Mailu Admin REST API
│   │   ├── auth.ts                # sessions in-memory, cookie HMAC-signed
│   │   └── rate-limit.ts          # token bucket por IP/usuario
│   └── app.css                    # Tailwind 4 + tokens
├── Dockerfile                     # multi-stage node:20-alpine
├── docker-compose.prod.yml        # Traefik labels + redes externas
├── env.required                   # claves obligatorias (versionado)
├── .env.example                   # plantilla
├── scripts/check-env.sh          # valida .env vs env.required
├── scripts/wait-healthy.sh        # espera healthy + HTTP
└── .github/workflows/deploy.yml   # self-hosted runner deploy
```

## Variables de entorno (`.env`, SOLO en VPS)

Definidas en `env.required`. Lo mínimo:

| Key | Descripción |
|---|---|
| `SESSION_SECRET` | 32+ caracteres aleatorios para firmar cookies HMAC. Genéralo con `openssl rand -hex 32`. |
| `MAILU_IMAP_HOST` | Nombre DNS del contenedor IMAP. Default `mailu-imap-1`. |
| `MAILU_IMAP_PORT` | `143` STARTTLS o `993` implícito. Default `143`. |
| `MAILU_SMTP_HOST` | Default `mailu-smtp-1`. |
| `MAILU_SMTP_PORT` | `587` STARTTLS o `465` implícito. Default `587`. |
| `MAILU_ADMIN_URL` | URL interna del Admin de Mailu. Default `http://mailu-admin-1:80`. |
| `MAILU_API_KEY` | Header `X-Api-Key` del Admin REST de Mailu (`SECRET_KEY` en /mailu/mailu.env). |
| `VITE_ADMIN_DOMAINS` | Lista CSV de dominios habilitados para ver `/admin`. Default `fastrecover.com`. |

## Seguridad SMTP/IMAP

- TLS terminado en Traefik (Let's Encrypt) para la web.
- IMAP STARTTLS interno; SMTP submission STARTTLS interno con auth.
- Sesiones HMAC-signed `fast_sid`, **password solo en RAM del server** (no en cookies ni logs). Acciónvulnerable al reinicio del container — avalable si querés persistencia con Redis en v2.
- Rate-limit: 10 logins/min/IP, 30 sends/min/IP+user, 20 admin ops/min/IP.
- `BODY_SIZE_LIMIT=5242880` (5MB) y headers Content-Type sanitizados en envío.
- Strict cookies: `httpOnly`, `secure`, `sameSite=lax`.

## Deploy

```bash
# En el VPS (como docker-steven)
ssh -i ~/.ssh/docker-steven docker-steven@2a02:4780:75:1d76::1
git clone https://github.com/Corporation-IDLE/fast-emails.git /home/docker-steven/fast-mails
cd /home/docker-steven/fast-mails
cp .env.example .env
nano .env   # rellenar SECRET, MAILU_API_KEY, dominios
docker compose -f docker-compose.prod.yml up -d --build
```

El deploy automático por GitHub Actions requiere:
1. Crear el repo `Corporation-IDLE/fast-emails`.
2. Registrar un self-hosted runner nuevo `actions-runner-fast` en el VPS (igual que `actions-runner-admin`).
3. Apuntar `scripts/wait-healthy.sh` a `fast-mails 30 2 3000` (ya configurado).

## Prerequisitos Mailu (VPS con sudo/root)

1. Agregar `mail.fastrecover.com` a `HOSTNAMES=` en `/mailu/mailu.env`.
2. Agregar los registros DNS en fastrecover.com:
   - `A  mail.fastrecover.com → 2.24.206.75` (o `AAAA :: → 2a02:4780:75:1d76::1` si usás IPv6 MX)
   - `MX  fastrecover.com → mail.fastrecover.com` (prioridad 10)
   - `TXT v=spf1 mx ~all`
   - DKIM `<selector>._domainkey.fastrecover.com` (lo genera Mailu Admin, validar selector en el panel)
   - `_dmarc.fastrecover.com TXT "v=DMARC1; p=quarantine; rua=mailto:postmaster@fastrecover.com"`
3. El rDNS (PTR) de la IP del VPS debe resolver a `mail.fastrecover.com` (Hostinger VPS → soporte).
4. Reiniciar Mailu: `cd /mailu && docker compose up -d` (o `restart`).

## Estado del desarrollo

- [x] Login vía IMAP, sessions server-side
- [x] Inbox listado paginado, mark read, delete
- [x] Compose + SMTP send
- [x] Admin vía Mailu REST (create/delete user)
- [ ] Vista de mensaje individual (`/thread/[uid]`)
- [ ] Adjuntos
- [ ] Carpeta Drafts/Sent/Trash
- [ ] Persistencia de sesiones con Redis (Mailu ya corre un `mailu-redis-1` reutilizable)
- [ ] Búsqueda IMAP (`SEARCH`)

## Pruebas locales

```bash
npm install
npm run dev
# abre http://localhost:5173 → redirige a /login
```

Para probar contra Mailu real desde tu laptop (sin estar en la red Docker), cambiá `MAILU_IMAP_HOST` a `mail.fastrecover.com` y `MAILU_IMAP_PORT` a `993` en tu `.env` local y `MAILU_SMTP_PORT` a `465`. Necesitarás reach pública de Mailu configurada.