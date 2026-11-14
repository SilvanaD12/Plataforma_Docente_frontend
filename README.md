# Plataforma_Docente_frontend
Frontend de Plataforma Docente 5E · Taller Integrador.

## Especificaciones y tareas

La [constitución](https://github.com/SilvanaD12/Plataforma_Docente_backend/blob/main/.specify/memory/constitution.md) y las [especificaciones por módulo](https://github.com/SilvanaD12/Plataforma_Docente_backend/tree/main/specs) se mantienen en el repositorio del backend y aplican a ambos repositorios.

Para trabajar en el frontend, consulta las tareas `[FE]` y `[E2E]` del módulo. En el PR enlaza la ficha y menciona los identificadores de las tareas que cubre el cambio.

## Páginas de una unidad

Las rutas hijas de `/courses/:courseId/units/:unitId` ya apuntan a la página de cada módulo. Cada responsable implementa su página y puede leer `course` y `unit` con `useOutletContext<UnitContext>()`.

| Ruta hija | Página |
| --- | --- |
| `material` | `src/features/materials/pages/MaterialPage.tsx` |
| `generation` | `src/features/generation/pages/GenerationPage.tsx` |
| `review` | `src/features/review/pages/ReviewPage.tsx` |
| `export` | `src/features/export/pages/ExportPage.tsx` |

## Pruebas

| Comando | Qué corre | Dónde |
| --- | --- | --- |
| `npm run lint` · `npm test` · `npm run build` | ESLint, Vitest y la compilación | Local y CI |
| `npm run test:e2e` | Recorridos de Playwright con la API simulada (`e2e/*.spec.ts`) | Local y CI |
| `npm run test:e2e:real` | Recorrido con un backend real local hasta descargar y validar el Moodle XML (`e2e/real/`) | Solo local |

La primera vez, instala el navegador con `npx playwright install chromium`. Las pruebas levantan Vite en el puerto 5199
(`PLAYWRIGHT_PORT` para cambiarlo); con `PLAYWRIGHT_BASE_URL` se apuntan a otra instancia del frontend.

### Recorrido con backend real (`test:e2e:real`)

Crea una cuenta, un curso con una unidad, sube y procesa un material, genera un ítem de opción múltiple, lo aprueba,
descarga el Moodle XML desde Exportación y lo valida con `backend/tests/support/moodle_xml_validator.py` del backend.
Usa el generador por reglas: no llama a la IA ni necesita claves.

1. Levanta el backend local en otra consola, desde `Plataforma_Docente_backend/backend`, con una base SQLite temporal:

   ```powershell
   $env:DATABASE_URL = "sqlite:///C:/Temp/ta002.db"
   $env:LLM_PROVIDER = "rules"
   $env:TOPIC_SEARCH_ENABLED = "false"
   $env:CORS_ALLOWED_ORIGINS = "http://localhost:5199"
   .\.venv\Scripts\python.exe -m uvicorn platform5e.main:app --port 8010
   ```

2. En este repositorio:

   ```powershell
   $env:VITE_API_URL = "http://127.0.0.1:8010"
   $env:BACKEND_REPO_DIR = "E:\ruta\a\Plataforma_Docente_backend"
   $env:BACKEND_PYTHON = "E:\ruta\a\Plataforma_Docente_backend\backend\.venv\Scripts\python.exe"
   npm run test:e2e:real
   ```

- `VITE_API_URL`: URL del backend local. Si no se define, se usa el proxy de Vite hacia `http://127.0.0.1:8000`.
- `BACKEND_REPO_DIR`: carpeta del repositorio del backend, para encontrar el validador. Si no se define, la prueba se
  salta con un aviso.
- `BACKEND_PYTHON`: Python para el validador, que se ejecuta en modo aislado (`-I`). Por defecto, `python`.

No apuntes `VITE_API_URL` a la API publicada: la prueba crea cuentas y cursos.
