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
