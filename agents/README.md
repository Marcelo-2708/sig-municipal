# SIG Municipal SaaS — Agentes Claude Code

## Qué es esto

Este directorio contiene las instrucciones (archivos `.md`) para los 6 agentes especializados que construirán la plataforma SIG Municipal. Cada archivo define la identidad, responsabilidades, stack técnico y criterios de éxito de cada agente.

## Los 6 agentes

| Archivo | Rol | Cuándo activarlo |
|---|---|---|
| `ORCHESTRATOR.md` | Coordinador general | Siempre. Es el punto de entrada |
| `GIS_AGENT.md` | GeoServer + PostGIS + capas | Cuando hay trabajo de mapas/capas |
| `BACKEND_AGENT.md` | API Node.js + autenticación | Cuando hay rutas o lógica de servidor |
| `FRONTEND_AGENT.md` | React + MapLibre GL JS + UI | Cuando hay componentes o pantallas |
| `DEVOPS_AGENT.md` | Docker + Nginx + hosting | Cuando hay infraestructura o despliegue |
| `DATABASE_AGENT.md` | PostgreSQL + esquemas + migraciones | Cuando hay tablas o queries |

## Cómo usar con Claude Code

### Opción A — Un agente por conversación (recomendado al inicio)
```bash
claude --system-prompt ORCHESTRATOR.md
# Luego el orquestador te dirá qué agente activar para cada tarea
```

### Opción B — Agente específico directo
```bash
# Cuando sabes exactamente qué necesitas
claude --system-prompt GIS_AGENT.md
claude --system-prompt BACKEND_AGENT.md
claude --system-prompt FRONTEND_AGENT.md
claude --system-prompt DEVOPS_AGENT.md
claude --system-prompt DATABASE_AGENT.md
```

### Opción C — Con archivos CLAUDE.md en cada carpeta del proyecto
Copia el contenido del agente correspondiente en un archivo `CLAUDE.md` dentro de cada directorio:
```
/proyecto/
  backend/
    CLAUDE.md   ← contenido de BACKEND_AGENT.md
  frontend/
    CLAUDE.md   ← contenido de FRONTEND_AGENT.md
  database/
    CLAUDE.md   ← contenido de DATABASE_AGENT.md
  geoserver/
    CLAUDE.md   ← contenido de GIS_AGENT.md
  infraestructura/
    CLAUDE.md   ← contenido de DEVOPS_AGENT.md
```

## Orden recomendado para empezar (Fase 1)

```
Semana 1:
  1. DATABASE_AGENT  → crear esquema base y esquema de municipio piloto
  2. DEVOPS_AGENT    → levantar Docker Compose con PostgreSQL + GeoServer
  3. GIS_AGENT       → configurar workspace y publicar primera capa

Semana 2:
  4. BACKEND_AGENT   → API base con autenticación y resolución de tenant
  5. FRONTEND_AGENT  → visor de mapa con capas básicas

Semana 3-4:
  6. Todos           → búsqueda predial, panel de capas, ajustes
```

## Stack técnico del proyecto

```
Frontend:     React 18 + Vite + MapLibre GL JS + Tailwind CSS
Backend:      Node.js 20 + Fastify + Prisma
Base de datos: PostgreSQL 15 + PostGIS 3.4
Mapas:        GeoServer 2.24
Cache:        Redis 7
Proxy:        Nginx
Contenedores: Docker + Docker Compose
```

## Reglas que aplican a todos los agentes

1. Variables y comentarios **en español**
2. **Nunca** hardcodear credenciales — siempre variables de entorno
3. Manejo explícito de errores en toda operación que pueda fallar
4. Logs estructurados para operaciones críticas
5. Los puertos de BD y GeoServer **nunca** expuestos públicamente

## Contacto entre agentes

Cuando un agente necesita algo de otro, usa este formato en el ORCHESTRATOR:

```
SOLICITUD ENTRE AGENTES
De: BACKEND_AGENT
Para: GIS_AGENT
Necesito: URL del endpoint WMS para la capa "predios" del workspace "concepcion"
Bloqueante: sí — no puedo terminar la ruta /api/capas hasta tenerlo
```
