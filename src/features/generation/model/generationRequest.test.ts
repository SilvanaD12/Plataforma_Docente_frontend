import { describe, expect, it } from 'vitest';
import {
  fallbackSteps, finishedStepCount, isTerminal, orderedSteps, requestLabel, reviewPath, stageLabel, stepLabel,
  verificationLabel, type GenerationStep, type RequestStatus, type StepStatus,
} from './generationRequest';

function step(position: number, overrides: Partial<GenerationStep> = {}): GenerationStep {
  return {
    position, stage: 'engage', resourceType: 'pregunta_detonante', agent: 'Agente de Enganchar',
    status: 'pending', resourceIds: [], rejections: [], ...overrides,
  };
}

describe('Pedido de generación', () => {
  it('reconoce los estados finales para dejar de consultar', () => {
    const terminal: RequestStatus[] = ['succeeded', 'partially_succeeded', 'failed', 'interrupted'];
    const active: RequestStatus[] = ['queued', 'running'];
    terminal.forEach((status) => expect(isTerminal(status)).toBe(true));
    active.forEach((status) => expect(isTerminal(status)).toBe(false));
  });

  it('nombra en español cada estado del pedido y de los pasos', () => {
    const steps: StepStatus[] = ['pending', 'running', 'succeeded', 'rejected', 'failed', 'interrupted'];
    expect(steps.map(stepLabel)).toEqual(['En espera', 'Generando', 'Listo', 'Rechazado', 'Con error', 'Interrumpido']);
    expect(requestLabel('partially_succeeded')).toBe('Terminado con resultados parciales');
    expect(stageLabel('evaluate')).toBe('Evaluar');
  });

  it('muestra la verificación como vigente o pendiente y la omite mientras no exista', () => {
    expect(verificationLabel('current')).toBe('Vigente');
    expect(verificationLabel('pending')).toBe('Pendiente');
    expect(verificationLabel(null)).toBeNull();
    expect(verificationLabel(undefined)).toBeNull();
  });

  it('ordena los pasos por posición y cuenta los que ya terminaron', () => {
    const steps = [
      step(2, { stage: 'evaluate', status: 'running' }),
      step(0, { status: 'succeeded' }),
      step(1, { stage: 'explain', status: 'rejected' }),
    ];
    expect(orderedSteps(steps).map(({ position }) => position)).toEqual([0, 1, 2]);
    expect(steps.map(({ position }) => position)).toEqual([2, 0, 1]);
    expect(finishedStepCount(steps)).toBe(2);
  });

  it('identifica solo los pasos redactados por el generador por reglas', () => {
    const steps = [
      step(1, { generator: { description: 'Reglas', usesAi: false, fallback: true } }),
      step(0, { generator: { description: 'Gemini', usesAi: true, fallback: false } }),
      step(2, { generator: null }),
    ];
    expect(fallbackSteps(steps).map(({ position }) => position)).toEqual([1]);
  });

  it('enlaza cada recurso con la pestaña Revisión de la misma unidad', () => {
    expect(reviewPath('rec/1')).toBe('../review?resource=rec%2F1');
  });
});
