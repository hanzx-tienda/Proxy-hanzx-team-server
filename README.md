# PROXY HANZX TEAM — servidor de keys

## Despliegue en Render
1. Sube estos archivos a un repositorio privado de GitHub.
2. En Render, crea un servicio Web Service desde ese repositorio.
3. Build command: `npm install`
4. Start command: `npm start`
5. Configura `ADMIN_TOKEN` como secreto largo y aleatorio. No lo pongas en la APK ni lo compartas.
6. Para conservar las keys entre reinicios, configura un disco persistente y `DB_PATH` apuntando a ese disco. El archivo `render.yaml` muestra un ejemplo; los discos persistentes pueden depender del plan de Render.

## Endpoints
- `GET /` — estado del servicio.
- `GET /api/llave?k=HANZX-...` — valida una key y devuelve `valida`, `vence`, `segundos`, `firma`.
- `POST /admin/keys` — crear key. Header `x-admin-token: TU_ADMIN_TOKEN`; JSON `{"expiresInSeconds":86400}`.
- `GET /admin/keys` — listar keys (mismo header).
- `POST /admin/keys/status` — pausar/revocar/activar. JSON `{"key":"HANZX-...","status":"revoked"}`.

Estados permitidos: `active`, `paused`, `revoked`.

## Prueba local
```bash
npm install
# Linux/macOS:
ADMIN_TOKEN='pon-un-secreto-largo' DB_PATH='./keys.db' npm start
```

## Importante
- Este servidor todavía NO está conectado a la APK. El APK debe consultar la URL pública de este servidor.
- La API pública usa GET para compatibilidad con clientes sencillos; para un producto final conviene migrar a POST para no dejar keys en logs de URL.
- `firma` es un hash informativo, no una firma criptográfica verificable con secreto del cliente.
- Protege `ADMIN_TOKEN`; si se filtra, alguien podría crear o revocar keys.
- No uses este servidor como sistema de seguridad fuerte sin pruebas, límites de peticiones y una base de datos persistente configurada.
