# Plan de Implementación: Restauración de Sistema MuseOS
## ✅ ESTADO: IMPLEMENTADO (14 Feb 2026)

Este documento detalla los pasos necesarios para solucionar los errores críticos de la plataforma (Vercel logs y consola) y reactivar el sistema de "Autopilot Scheduler" que actualmente no se está ejecutando.

## 1. Diagnóstico de Problemas

### A. Error Crítico de Variables de Entorno
**Síntoma:** `CRITICAL: VITE_TABLE_PROFILES variable missing.` y `Error fetching profile`.
**Causa:** La aplicación React (Frontend) requiere la variable `VITE_TABLE_PROFILES` para saber de qué tabla leer el perfil del usuario, pero esta variable no está configurada en el entorno de Vercel. Al ser una build de Vite, solo las variables que empiezan por `VITE_` son expuestas al navegador.

### B. Fallo del Generador Manual (Error 400)
**Síntoma:** `/api/workflow/generate` devuelve 400.
**Causa:** El endpoint valida la existencia de configuración (perfil, keywords, o creadores) antes de ejecutar.
1. Si `TABLE_PROFILES` falta en el Backend -> Error 500 (o 400 si el try/catch lo captura así).
2. Si el perfil no tiene `niche_keywords` (para modo keywords) -> Error 400.
3. Si la tabla de creadores está vacía (para modo creadores) -> Error 400.

### C. Autopilot Scheduler "Muerto"
**Síntoma:** Se guarda la configuración en la tabla `schedules` (Status 200), pero nunca se ejecuta.
**Causa:** La arquitectura actual en Vercel es "Serverless". Esto significa que no hay un servidor corriendo las 24h para ejecutar `server/services/schedulerService.ts` (que usa `node-cron`). Vercel "duerme" cuando no recibe peticiones.
**Solución Requerida:** Migrar la lógica de cron a **Vercel Cron Jobs**, que invoca un endpoint específico de tu API a intervalos regulares.

---

## 2. Plan de Implementación Paso a Paso

### Paso 1: Configuración de Entorno (Vercel)
Primero, debemos asegurar que tanto el Frontend como el Backend tengan acceso a las variables necesarias.

**Acción:** Ir al panel de Vercel > Settings > Environment Variables y agregar:

| Variable | Valor Sugerido | Propósito |
|----------|----------------|-----------|
| `VITE_TABLE_PROFILES` | `profiles` | **Permite al frontend cargar el perfil** |
| `TABLE_PROFILES` | `profiles` | Uso del backend para workflows |
| `TABLE_POSTS` | `posts` | Donde guardar posts generados |
| `TABLE_CREATORS` | `creators` | Fuente para modo "Parasite" |
| `VITE_SUPABASE_URL` | (Tu URL) | Conexión cliente |
| `VITE_SUPABASE_ANON_KEY` | (Tu Key) | Conexión cliente |
| `SUPABASE_URL` | (Tu URL) | Conexión backend |
| `SUPABASE_SERVICE_ROLE_KEY` | (Tu Service Key) | Escritura admin backend |
| `OPENAI_API_KEY` | (Tu Key) | Generación de contenido |
| `APIFY_API_TOKEN` | (Tu Token) | Scraping de LinkedIn |
| `CRON_SECRET` | (Generar uno random) | Proteger el endpoint del cron |

### Paso 2: Implementación del Autopilot en Vercel (Backend)
Como no podemos usar `node-cron` en Vercel, crearemos un endpoint que Vercel llame automáticamente.

**Archivo a modificar:** `api/index.ts`
1.  Crear una nueva ruta `GET /cron`.
2.  Esta ruta verificará el "secreto" (`CRON_SECRET`) para seguridad.
3.  Leerá la tabla `schedules` buscando tareas habilitadas (`enabled: true`).
4.  Comparará la hora actual con la hora programada (`time`).
    *   *Nota:* Como los crons pueden no ser exactos al segundo, usaremos una ventana de tiempo (ej. "si la hora actual es igual a la hora programada").
5.  Si coincide, ejecutará la función `executeWorkflowGenerate` internamente reutilizando la lógica existente.
6.  Registrará la ejecución en `schedule_executions`.

### Paso 3: Configuración de Vercel Cron
Para que Vercel llame a `/api/cron`, debemos configurar `vercel.json`.

**Archivo a modificar:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 * * * *" 
    }
  ],
  // ... resto de tu configuración
}
```
*Recomendación:* Configurar el cron para correr cada hora (`0 * * * *`) si la granularidad de los schedules es por hora, o cada 15 mins (`*/15 * * * *`) si necesitas más precisión.

### Paso 4: Unificación y Limpieza
El proyecto tiene código duplicado en `server/` y `api/`.
1.  Confirmar que `api/index.ts` es la única fuente de verdad para Vercel.
2.  Asegurarse de que las correcciones de "Error 400" (mensajes de error más claros) se apliquen en `api/index.ts`.

### Paso 5: Verificación de Base de Datos (Supabase)
Ejecutar un script SQL o verificar manualmente en Supabase:
1.  ¿Existe la tabla `profiles` con al menos una fila para tu usuario?
2.  ¿Tiene esa fila datos en `niche_keywords` (array de strings)?
3.  ¿Existe la tabla `creators` y tiene filas con `linkedin_url` válidos?

---

## 3. Resumen Técnico de Cambios a Realizar

1.  **`vercel.json`**: Agregar bloque `"crons"`.
2.  **`api/index.ts`**:
    *   Agregar endpoint `router.get('/cron', ...)`
    *   Implementar lógica de chequeo de hora y ejecución condicional.
    *   Mejorar logs de error en `executeWorkflowGenerate` para diagnosticar por qué fallan los requests manuales (saber si es por falta de keywords o falta de creadores).
3.  **Vercel Dashboard**: Configurar variables de entorno faltantes.

¿Procedemos a ejecutar este código?
