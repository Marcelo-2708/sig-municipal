# SIG Municipal — Plataforma WebGIS para Municipalidades Chilenas

## Descripción del proyecto

Plataforma WebGIS multi-tenant SaaS. Cada municipalidad accede por su propio subdominio
(`sig.concepcion.cl`, `sig.chiguayante.cl`). El equipo técnico municipal publica capas desde
QGIS hacia GeoServer; ciudadanos y funcionarios consultan el mapa web en el navegador.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend API | Node.js + Fastify |
| Frontend | React + MapLibre GL JS |
| Base de datos | PostgreSQL + PostGIS |
| Servidor de mapas | GeoServer |
| Infraestructura | Docker + Nginx |

## Estructura de carpetas

```
sig-municipal/
├── agents/          # Instrucciones para cada agente Claude Code
├── backend/         # API REST (Fastify)
│   └── src/
├── frontend/        # Aplicación React
│   └── src/
├── database/        # Migraciones SQL y seeds
│   ├── migrations/
│   └── seeds/
├── geoserver/       # Configuración y estilos SLD
│   ├── config/
│   └── estilos/
├── infra/           # Docker Compose, Nginx, scripts de despliegue
│   ├── docker/
│   └── nginx/
└── docs/            # Documentación técnica y de negocio
```

## Convenciones obligatorias (todos los agentes deben cumplirlas)

- Variables, comentarios y mensajes de log en **español**
- Sin credenciales hardcodeadas — siempre variables de entorno (`.env`)
- Manejo explícito de errores; nunca `catch` vacío
- Logs estructurados en cada operación crítica
- Tests para funciones de negocio críticas

## Agentes disponibles

| Agente | Responsabilidad |
|---|---|
| `ORCHESTRATOR` | Planifica, divide tareas y coordina a los demás |
| `DATABASE_AGENT` | Esquemas PostgreSQL/PostGIS, migraciones, índices |
| `BACKEND_AGENT` | API REST, rutas Fastify, middleware, autenticación JWT |
| `FRONTEND_AGENT` | React, componentes, mapa MapLibre, UI/CSS |
| `GIS_AGENT` | GeoServer, WMS/WFS, estilos SLD, capas |
| `DEVOPS_AGENT` | Docker, Nginx, subdominios, SSL, CI/CD |

Cada agente tiene sus instrucciones detalladas en `agents/<NOMBRE>.md`.

## Estado del proyecto

Ver `PROJECT_STATUS.md` para el estado actualizado de tareas y fases.

## Fases del proyecto

- **Fase 1** (sem. 1–4): Fundación — Docker, BD, API base, Frontend base, piloto end-to-end
- **Fase 2** (sem. 5–8): Panel de administración — gestión de capas, usuarios, onboarding
- **Fase 3** (sem. 9–16): Funcionalidades avanzadas — búsqueda predial, reportes ciudadanos, IDE Chile
- **Fase 4** (sem. 17+): Producción y escala — SSL automático, monitoreo, backups, CI/CD
