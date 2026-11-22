import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { escapeHtml, initialContent, RichTextEditor } from './RichTextEditor';

function createMockEditor(overrides: Partial<Record<string, unknown>> = {}): Editor {
  const chainObj = {
    focus: () => chainObj,
    toggleBold: () => chainObj,
    toggleItalic: () => chainObj,
    toggleUnderline: () => chainObj,
    toggleStrike: () => chainObj,
    toggleHeading: () => chainObj,
    toggleBulletList: () => chainObj,
    toggleOrderedList: () => chainObj,
    toggleBlockquote: () => chainObj,
    extendMarkRange: () => chainObj,
    setLink: () => chainObj,
    unsetLink: () => chainObj,
    run: vi.fn(),
  };

  const commands = {
    setContent: vi.fn(),
  };

  return {
    isActive: vi.fn((name: string) => name === 'bold'),
    getAttributes: vi.fn(() => ({})),
    getHTML: vi.fn(() => '<p>Contenido actual</p>'),
    getText: vi.fn(() => 'Contenido actual'),
    setEditable: vi.fn(),
    chain: () => chainObj,
    commands,
    ...overrides,
  } as unknown as Editor;
}

describe('escapeHtml', () => {
  it('escapa caracteres especiales HTML', () => {
    expect(escapeHtml('si a<b y b>c')).toBe('si a&lt;b y b&gt;c');
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("rock 'n' roll & pop")).toBe('rock &#39;n&#39; roll &amp; pop');
  });
});

describe('initialContent', () => {
  it('devuelve párrafo vacío si no hay valores', () => {
    expect(initialContent()).toBe('<p></p>');
    expect(initialContent(null, '')).toBe('<p></p>');
  });

  it('prioriza valueHtml cuando está presente', () => {
    expect(initialContent('<p><strong>HTML</strong></p>', 'Texto')).toBe('<p><strong>HTML</strong></p>');
  });

  it('escapa valueText y no pierde caracteres como < o >', () => {
    const html = initialContent(null, 'si a<b y b>c');
    expect(html).toBe('<p>si a&lt;b y b&gt;c</p>');
    expect(html).not.toContain('<b y b>');
  });

  it('convierte saltos de párrafo y escapa etiquetas potencialmente maliciosas', () => {
    const text = 'Párrafo 1\ncon salto\n\nPárrafo 2 <script>alert(1)</script>';
    const html = initialContent(null, text);
    expect(html).toContain('<p>Párrafo 1<br>con salto</p>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('RichTextEditor en fallback SSR (!editor)', () => {
  it('renderiza con role="textbox", aria-multiline y aria-busy="true"', () => {
    const html = renderToStaticMarkup(
      <RichTextEditor valueText="Prueba" onChange={() => {}} />,
    );
    expect(html).toContain('role="textbox"');
    expect(html).toContain('aria-multiline="true"');
    expect(html).toContain('aria-busy="true"');
  });

  it('muestra el texto completo sin evaluar etiquetas ni perder a<b y b>c', () => {
    const html = renderToStaticMarkup(
      <RichTextEditor valueText="si a<b y b>c" onChange={() => {}} />,
    );
    expect(html).toContain('si a&lt;b y b&gt;c');
  });

  it('no crea elementos HTML ejecutables ante inyecciones de script o img', () => {
    const html = renderToStaticMarkup(
      <RichTextEditor valueText='<img src=x onerror="alert(1)">' onChange={() => {}} />,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});

describe('RichTextEditor con editor activo', () => {
  it('muestra la barra de herramientas con botones de formato', () => {
    const mockEditor = createMockEditor();
    const html = renderToStaticMarkup(
      <RichTextEditor testEditor={mockEditor} valueText="Texto" onChange={() => {}} />,
    );
    expect(html).toContain('aria-label="Negrita"');
    expect(html).toContain('aria-label="Cursiva"');
    expect(html).toContain('aria-label="Subrayado"');
    expect(html).toContain('aria-label="Tachado"');
    expect(html).toContain('aria-label="Título 1"');
    expect(html).toContain('aria-label="Título 2"');
    expect(html).toContain('aria-label="Título 3"');
    expect(html).toContain('aria-label="Lista con viñetas"');
    expect(html).toContain('aria-label="Lista numerada"');
    expect(html).toContain('aria-label="Cita en bloque"');
    expect(html).toContain('aria-label="Enlace web"');
  });

  it('marca botón activo según estado del editor', () => {
    const mockEditor = createMockEditor({
      isActive: vi.fn((name: string) => name === 'bold'),
    });
    const html = renderToStaticMarkup(
      <RichTextEditor testEditor={mockEditor} valueText="Texto" onChange={() => {}} />,
    );
    expect(html).toContain('rich-editor__btn is-active');
  });

  it('deshabilita controles cuando disabled=true', () => {
    const mockEditor = createMockEditor();
    const html = renderToStaticMarkup(
      <RichTextEditor testEditor={mockEditor} valueText="Texto" disabled={true} onChange={() => {}} />,
    );
    expect(html).toContain('rich-editor--disabled');
    expect(html).toContain('disabled=""');
  });
});
