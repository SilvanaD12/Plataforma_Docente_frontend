/// <reference types="node" />
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const MATERIAL = [
  'TCP establece una conexión y confirma la entrega de los datos.',
  'UDP envía datagramas sin establecer una conexión ni confirmar la entrega.',
  'IP identifica el destino de los paquetes y permite encaminarlos entre redes.',
].join('\n\n');

test('T072: interpreta, edita y confirma un solo pedido en la unidad activa', async ({ page, baseURL }) => {
  const apiBase = (process.env.VITE_API_URL || baseURL || '').replace(/\/$/, '');
  const requestsUrl = `${apiBase}/api/v1/generation-requests`;

  // Una cuenta nueva aísla los pedidos de esta ejecución.
  await page.goto('/registro');
  const password = randomUUID();
  await page.getByLabel('Nombre y apellido').fill('Prueba T072');
  await page.getByLabel('Correo electrónico').fill(`t072-${randomUUID()}@example.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Repite la contraseña').fill(password);

  const registering = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/accounts'
      && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  const account = await registering;
  expect(account.status()).toBe(201);
  const { token } = await account.json();
  const headers = { Authorization: `Bearer ${token}` };

  const courseResponse = await page.request.post(`${apiBase}/api/v1/courses`, {
    headers,
    data: {
      code: 'T072',
      name: 'Redes T072',
      term: '2026-II',
      units: [{ title: 'TCP/IP' }, { title: 'UDP' }],
    },
  });
  expect(courseResponse.status()).toBe(201);
  const course = await courseResponse.json();
  const [tcp, udp] = course.units;
  const unitPath = `/courses/${course.id}/units/${tcp.id}`;

  await page.goto(`${unitPath}/material`);
  await page.locator('#material-file-input').setInputFiles({
    name: 'protocolos.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(MATERIAL, 'utf-8'),
  });
  await page.getByRole('button', { name: 'Subir material' }).click();
  await page.getByRole('button', { name: 'Procesar' }).click();
  await expect(page.getByText('procesado', { exact: true })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('link', { name: 'Generación', exact: true }).click();
  const chat = page.getByRole('form', { name: 'Chat de Generación' });
  const input = chat.getByRole('textbox');
  const interpret = chat.getByRole('button', { name: 'Interpretar' });

  await input.fill('Quiero un recurso para la etapa Explorar');
  await interpret.click();
  await expect(chat.getByText('Elige un tipo de recurso para la etapa indicada.', { exact: false }))
    .toBeVisible();

  await input.fill('Para UDP, quiero un glosario');
  await interpret.click();
  await expect(chat.getByText('Unidad sugerida: UDP.', { exact: false })).toBeVisible();
  await expect(chat.getByText('Unidad activa: TCP/IP', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}${unitPath}/generation`);

  await input.fill('Para TCP/IP, quiero dos glosarios');
  await interpret.click();
  await expect(page.getByRole('radio', { name: 'Glosario', exact: true })).toBeChecked();

  const quantity = page.locator('select[name="quantity"]');
  await expect(quantity).toHaveValue('2');
  await quantity.selectOption('1');

  await page.getByRole('button', { name: 'Generar recurso' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa el pedido antes de generar' })).toBeVisible();
  await expect(page.getByText('Total: 1 recurso', { exact: true })).toBeVisible();

  async function listRequests(unitId: string) {
    const response = await page.request.get(requestsUrl, {
      headers,
      params: { unitId, active: 'false' },
    });
    expect(response.status()).toBe(200);
    return response.json();
  }

  expect(await listRequests(tcp.id)).toHaveLength(0);

  const creating = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/generation-requests'
      && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirmar y generar' }).click();

  const created = await creating;
  expect(created.status()).toBe(202);
  const order = await created.json();
  expect(order).toMatchObject({
    unitId: tcp.id,
    parameters: { resourceTypes: ['glosario'], quantity: 1 },
  });

  const requests = await listRequests(tcp.id);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ id: order.id });
  expect(await listRequests(udp.id)).toHaveLength(0);
});