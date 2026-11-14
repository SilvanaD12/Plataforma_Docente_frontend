import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * TA-002 con backend real (solo en local, no en CI): crear cuenta → curso y unidad → subir y procesar material →
 * generar un ítem de opción múltiple con el generador por reglas → aprobarlo en Revisión → descargar el Moodle XML
 * desde la interfaz y validarlo con el validador del backend (backend/tests/support/moodle_xml_validator.py).
 *
 * Variables de entorno (ver README, «Pruebas»):
 * - VITE_API_URL: URL del backend local (si no se define, el proxy de Vite usa http://127.0.0.1:8000).
 * - BACKEND_REPO_DIR: carpeta del repositorio Plataforma_Docente_backend. Sin ella, la prueba se salta.
 * - BACKEND_PYTHON: ejecutable de Python para el validador (por defecto, `python`).
 */

const backendRepo = process.env.BACKEND_REPO_DIR;
const validator = backendRepo && path.join(backendRepo, 'backend', 'tests', 'support', 'moodle_xml_validator.py');
const python = process.env.BACKEND_PYTHON ?? 'python';
const apiBase = (process.env.VITE_API_URL ?? '').replace(/\/$/, '');

const MATERIAL = [
  'Unidad 1: Protocolos de transporte',
  '',
  'El protocolo TCP es orientado a la conexión y garantiza una entrega confiable de los datos. ' +
    'El protocolo UDP no establece conexión ni confirma la entrega; por eso es más rápido.',
  '',
  'El protocolo IP se encarga del direccionamiento y del enrutamiento de los paquetes. ' +
    'El enrutador es el dispositivo que decide el camino de cada paquete hasta su destino. ' +
    'La encapsulación es el proceso por el cual cada capa agrega su propio encabezado a los datos.',
].join('\n');

test.skip(!backendRepo, 'Define BACKEND_REPO_DIR con la ruta de Plataforma_Docente_backend para validar el Moodle XML.');

test('de la cuenta nueva a la descarga del Moodle XML, validado con el validador del backend', async ({ page, baseURL }, testInfo) => {
  expect(existsSync(validator!), `No se encontró el validador en ${validator}`).toBe(true);
  // Con VITE_API_URL se consulta el backend directo; sin ella, a través del proxy de Vite.
  const probe = apiBase ? `${apiBase}/health` : `${baseURL}/api/v1/resource-types`;
  const health = await page.request.get(probe).catch(() => null);
  expect(health?.ok(), `El backend local no responde en ${probe}. Ver README, «Pruebas».`).toBe(true);

  // Cuenta nueva con contraseña generada al momento (no se muestra).
  const email = `ta002-${Date.now()}@example.com`;
  await page.goto('/registro');
  await page.getByLabel('Nombre y apellido').fill('Prueba TA-002');
  await page.getByLabel('Correo electrónico').fill(email);
  const password = randomUUID();
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Repite la contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis cursos' })).toBeVisible();

  // Curso con una unidad y un resultado de aprendizaje.
  await page.getByRole('link', { name: 'Nuevo curso' }).click();
  await page.getByLabel('Código', { exact: true }).fill('TA002');
  await page.getByLabel('Nombre del curso').fill('Redes TA-002');
  await page.getByLabel('Periodo').fill('2026-II');
  await page.getByLabel('Título de la unidad').fill('Capa de transporte');
  await page.getByLabel('Resultados de aprendizaje (opcional)').fill('RA1: Distingue TCP y UDP');
  await page.getByRole('button', { name: 'Guardar curso' }).click();
  await page.goto('/courses');
  await page.getByRole('link', { name: 'Entrar al curso' }).click();
  await page.getByRole('link', { name: 'Abrir unidad' }).click();
  const tabs = page.getByRole('navigation', { name: 'Secciones de la unidad' });

  // Material: subir y procesar.
  await tabs.getByRole('link', { name: 'Material' }).click();
  await page.locator('#material-file-input').setInputFiles({
    name: 'protocolos.txt', mimeType: 'text/plain', buffer: Buffer.from(MATERIAL, 'utf-8'),
  });
  await page.getByRole('checkbox', { name: /Distingue TCP y UDP/ }).check();
  await page.getByRole('button', { name: 'Subir material' }).click();
  await page.getByRole('button', { name: 'Procesar' }).click();
  await expect(page.getByText('procesado', { exact: true })).toBeVisible({ timeout: 60_000 });

  // Generación: un ítem de opción múltiple (el backend local usa LLM_PROVIDER=rules).
  await tabs.getByRole('link', { name: 'Generación' }).click();
  await page.getByRole('radio', { name: /Recurso individual/ }).check();
  await page.getByRole('radio', { name: 'Preguntas de opción múltiple' }).check();
  await page.getByRole('button', { name: 'Generar recurso' }).click();
  await page.getByRole('button', { name: 'Confirmar y generar' }).click();
  await page.getByRole('link', { name: 'Ir a Revisión' }).click({ timeout: 120_000 });

  // Revisión: aceptar los distractores y aprobar.
  await expect(page.getByText('Pendiente de revisión')).toBeVisible();
  const correct = await page.getByLabel('Texto de la respuesta correcta').inputValue();
  const title = await page.getByLabel('Título').first().inputValue();
  for (const decision of await page.getByLabel('Decisión sobre el distractor').all()) {
    await decision.selectOption({ label: 'Aceptar' });
  }
  await page.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();

  // Exportación: descargar el Moodle XML desde la interfaz.
  await tabs.getByRole('link', { name: 'Exportación' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar .xml' }).click();
  const download = await downloading;
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  expect(download.suggestedFilename()).toMatch(/moodle\.xml$/);

  // Validación con el validador del backend, en modo aislado.
  const result = execFileSync(python, ['-I', validator!, file], { encoding: 'utf-8' });
  expect(result).toContain('OK');

  // La pregunta aprobada está en el archivo, con fraction="100" en la respuesta correcta.
  const xml = readFileSync(file, 'utf-8');
  expect(xml).toContain(title);
  const answers = [...xml.matchAll(/<answer fraction="(\d+(?:\.\d+)?)"[^>]*>\s*<text><!\[CDATA\[(.*?)\]\]><\/text>/gs)];
  const right = answers.filter(([, fraction]) => Number(fraction) === 100).map(([, , text]) => text.replace(/<[^>]+>/g, '').trim());
  expect(right).toEqual([correct.trim()]);
});
