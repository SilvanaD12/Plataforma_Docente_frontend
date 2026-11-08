import { describe, expect, it } from 'vitest';
import { courseFormProblem, courseRequest } from './courseForm';

const form = {
  code: ' RED-301 ',
  name: ' Redes ',
  term: ' 2026-II ',
  summary: ' ',
  learningGoal: ' ',
  units: [{ title: ' Transporte ', outcomes: ' ra1.1: Compara TCP y UDP.\n\n Describe la encapsulación. ' }],
};

describe('Formulario de cursos', () => {
  it('normaliza los datos y deja que el servidor numere los resultados sin código', () => {
    const request = courseRequest(form);
    expect(request).toEqual({
      code: 'RED-301', name: 'Redes', term: '2026-II', summary: '', learningGoal: '',
      units: [{ title: 'Transporte', outcomes: [
        { code: 'RA1.1', text: 'Compara TCP y UDP.' },
        { text: 'Describe la encapsulación.' },
      ] }],
    });
    expect(courseFormProblem(request)).toBeNull();
  });

  it('exige un curso con al menos una unidad y un título por unidad', () => {
    expect(courseFormProblem(courseRequest({ ...form, name: '  ' }))).toMatch(/nombre/);
    expect(courseFormProblem(courseRequest({ ...form, units: [] }))).toMatch(/al menos una unidad/);
    expect(courseFormProblem(courseRequest({ ...form, units: [{ title: '  ', outcomes: '' }] }))).toMatch(/título de la unidad 1/);
  });

  it('conserva los identificadores guardados y omite los de las unidades y resultados nuevos', () => {
    const request = courseRequest({
      ...form,
      units: [
        { id: 'unidad-guardada', title: 'Transporte', outcomes: 'Resultado nuevo', savedOutcomes: [
          { id: 'resultado-guardado', code: 'RA1.1', text: 'Texto actualizado' },
        ] },
        { title: 'Capa de red', outcomes: '' },
      ],
    });

    expect(request.units).toEqual([
      { id: 'unidad-guardada', title: 'Transporte', outcomes: [
        { id: 'resultado-guardado', code: 'RA1.1', text: 'Texto actualizado' },
        { text: 'Resultado nuevo' },
      ] },
      { title: 'Capa de red', outcomes: [] },
    ]);
  });
});
