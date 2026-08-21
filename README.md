# Idec Mails — Webmail IDEC

UI y backend TypeScript para acceder al correo Mailu del dominio `idec.ec`. Reemplaza el Webmail Roundcube con una identidad visual propia (azul IDEC), y opcionalmente el Admin Flask de Mailu si la REST API está habilitada.

> **No reemplaza el servidor SMTP/IMAP.** Mailu ya corre en el VPS y atiende `@idec.ec` desde `mail.idec.ec`. Idec Mails habla con Mailu por DNS interno de Docker.

## Cuentas en Mailu (dominio `idec.ec`)

Cuentas habilitadas, validan contra Mailu IMAP:

```
admin@idec.ec              postmaster@idec.ec
info@idec.ec               sistemas@idec.ec
```

> Las cuentas deben existir en Mailu antes de usar Idec Mails.

## Stack

- **SvelteKit 5** (runes) + `adapter-node` — SSR en un solo contenedor Node.
- **Tailwind CSS 4** — paleta IDEC (`#0d5ea0 → #0277bd → #0091ea`), azules corporativos saturados.
- **imapflow** — IMAP (`mailu-imap-1:143`).
- **nodemailer** — SMTP submission (`mailu-smtp-1:587`).
- **Mailu Admin REST API** (opcional, off por defecto) — gestión de dominios/usuarios.
- **node:20-alpine** multi-stage, mismo patrón que `nexus-admin`.

## Arquitectura

```
Internet → Traefik (coolify-proxy) ─ HTTPS mail.idec.ec ─ idec-mails:3000
                                                                      │
                                      red `mailu_default` (Docker ext)─┼─ mailu-imap-1:143   (login IMAP)
                                                                      ├─ mailu-smtp-1:587   (envío SMTP)
                                                                      └─ mailu-admin-1:80   (REST, opcional)
```

El container está en **dos redes externas**:
- `coolify` → Traefik HTTPS público (mismo reverse proxy que idec-web/nexus-admin).
- `mailu_default` → acceso interno a IMAP/SMTP/Admin sin exponer puertos ni pasar por Traefik.

## Estructura

```
idec-mails/
├── src/
│   ├── hooks.server.ts            # auth middleware (session HMAC-signed)
│   ├── routes/
│   │   ├── login/                 # login IMAP (password solo en RAM del server)
│   │   ├── logout/                # POST destruye sesión
│   │   ├── inbox/                 # listado IMAP paginado, mark read, delete
│   │   ├── compose/               # envío SMTP
│   │   ├── admin/                 # CRUD usuarios/dominios vía Mailu REST (opcional)
│   │   └── health/                # /health (Docker + Traefik probe)
│   ├── lib/server/
│   │   ├── imap.ts                # imapflow
│   │   ├── smtp.ts                # nodemailer
│   │   ├── mailu-admin.ts         # Mailu Admin REST API
│   │   ├── auth.ts                # sessions in-memory, cookie HMAC-signed
│   │   └── rate-limit.ts          # token bucket por IP/usuario
│   └── app.css                    # Tailwind 4 + tokens IDEC
├── Dockerfile                     # multi-stage node:20-alpine
├── docker-compose.prod.yml        # Traefik labels + redes externas
├── env.required                   # claves obligatorias (versionado)
├── .env.example                   # plantilla
├── scripts/check-env.sh           # valida .env vs env.required
├── scripts/wait-healthy.sh        # espera healthy + HTTP
└── .github/workflows/deploy.yml   # self-hosted runner deploy
```

## Variables de entorno (`.env`, SOLO en VPS)

| Key | Descripción |
|---|---|
| `SESSION_SECRET` | 32+ caracteres aleatorios. `openssl rand -hex 32`. |
| `MAILU_IMAP_HOST` | Default `mailu-imap-1`. |
| `MAILU_IMAP_PORT` | `143` STARTTLS o `993` implícito. |
| `MAILU_SMTP_HOST` | Default `mailu-smtp-1`. |
| `MAILU_SMTP_PORT` | `587` STARTTLS o `465` implícito. |
| `MAILU_ADMIN_URL` | Default `http://mailu-admin-1:80`. |
| `MAILU_API_KEY` | Si vacío, `/admin` se deshabilita con un banner y solo gestiona desde `mail.idec.ec/admin`. Si lo configurás, debe ser igual al `API_TOKEN` de Mailu. |
| `VITE_ADMIN_DOMAINS` | Dominios cuyas cuentas pueden ver `/admin`. Default `idec.ec`. |
| `MAIL_DOMAIN` | Dominio del cual sirve Idec Mails. `idec.ec`. |

## Seguridad SMTP/IMAP

- TLS terminado en Traefik (Let's Encrypt) para la web.
- IMAP STARTTLS interno; SMTP submission STARTTLS interno con auth.
- Sesiones HMAC-signed `idec_sid`, **password solo en RAM del server** (no en cookies ni logs).
- Rate-limit: 10 logins/min/IP, 30 sends/min/IP+user, 20 admin ops/min/IP.
- `BODY_SIZE_LIMIT=5242880` (5MB).
- Cookies strict: `httpOnly`, `secure`, `sameSite=lax`.

## Deploy

```bash
# En el VPS (como docker-steven)
ssh -i ~/.ssh/docker-steven docker-steven@2a02:4780:75:1d76::1
git clone https://github.com/Corporation-IDLE/idec-mails.git /home/docker-steven/idec-mails
cd /home/docker-steven/idec-mails
cp .env.example .env
nano .env   # rellenar SESSION_SECRET y opcionalmente MAILU_API_KEY
docker compose -f docker-compose.prod.yml up -d --build
```

Deploy automático por GitHub Actions requiere:
1. Crear el repo `Corporation-IDLE/idec-mails`.
2. Registrar self-hosted runner nuevo `idec-runner` en el VPS.
3. Apuntar `scripts/wait-healthy.sh` a `idec-mails 30 2 3000` (ya configurado).

## Prerequisitos Mailu (VPS con sudo/root)

El dominio `idec.ec` **ya debe existir en Mailu**. Faltaría solo:

1. **DNS**: crear `A mail.idec.ec → <IP del VPS>` (no existe todavía).
2. (Opcional) Agregar `mail.idec.ec` a `HOSTNAMES=` en `/mailu/mailu.env` si querés que Mailu también escuche por ese hostname público. **No es requerido para que Idec Mails funcione** — Idec Mails habla con Mailu por DNS interno (`mailu-imap-1`).
3. **DKIM**: publicar `<selector>._domainkey.idec.ec` (ver selector en la admin de Mailu).
4. **DMARC**: subir de `p=none` → `p=quarantine` con `pct=10` inicial.
5. **(Opcional) Habilitar REST API**: en `/mailu/mailu.env` poner `API=true` y `API_TOKEN=<token>` → reiniciar Mailu → copiar el mismo token a `MAILU_API_KEY` del `.env` de Idec Mails.

## Pruebas locales

```bash
npm install
npm run dev
# http://localhost:5173 → /login
# Probá con: postmaster@idec.ec / <password real>
```

Para probar contra Mailu real desde tu laptop (sin estar en la red Docker), cambiar en tu `.env` local:

```
MAILU_IMAP_HOST=mail.idec.ec
MAILU_IMAP_PORT=993
MAILU_SMTP_HOST=mail.idec.ec
MAILU_SMTP_PORT=465
```

## Estado del desarrollo

- [x] Login vía IMAP, sessions server-side
- [x] Inbox listado paginado, mark read, delete
- [x] Compose + SMTP send
- [x] Admin vía Mailu REST (opcional, gracefully degraded si API=false)
- [ ] Vista de mensaje individual (`/thread/[uid]`)
- [ ] Adjuntos
- [ ] Carpeta Drafts/Sent/Trash
- [ ] Persistencia de sesiones con Redis
- [ ] Búsqueda IMAP (`SEARCH`)

## Auditoría inicial (Jul 2026)

| | |
|---|---|
| Dominio en Mailu | `idec.ec` ✅ |
| Cuentas habilitadas | Verificar en admin de Mailu |
| Login IMAP interno | `mailu-imap-1:143` ✅ |
| Mailu REST API | `API=false` (admin deshabilitado; usar `mail.idec.ec/admin`) |
| MX idec.ec | Configurar `mail.idec.ec` |
| SPF | Configurar `v=spf1 mx a:mail.idec.ec ~all` |
| DMARC | `v=DMARC1; p=none` (subir a quarantine) |
| DKIM | pendiente publicar en DNS |