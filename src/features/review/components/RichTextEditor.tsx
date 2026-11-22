import { useEffect, useState } from 'react';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface RichTextEditorProps {
  id?: string;
  labelId?: string;
  valueHtml?: string | null;
  valueText?: string;
  disabled?: boolean;
  onChange: (html: string, plainText: string) => void;
}

function initialContent(valueHtml?: string | null, valueText?: string): string {
  if (valueHtml && valueHtml.trim()) {
    return valueHtml;
  }
  if (valueText && valueText.trim()) {
    return valueText
      .split(/\n{2,}/)
      .filter((p) => p.trim())
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  return '<p></p>';
}

export function RichTextEditor({
  id,
  labelId,
  valueHtml,
  valueText,
  disabled = false,
  onChange,
}: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const content = initialContent(valueHtml, valueText);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: (href) => /^(https?|mailto):/i.test(href),
      }),
    ],
    content,
    editable: !disabled,
    onUpdate({ editor: currentEditor }) {
      const html = currentEditor.getHTML();
      const plainText = currentEditor.getText();
      onChange(html, plainText);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  function handleOpenLinkDialog() {
    if (!editor) return;
    const previousUrl = (editor.getAttributes('link').href as string) || '';
    setLinkUrl(previousUrl);
    setLinkError(null);
    setShowLinkInput((prev) => !prev);
  }

  function handleApplyLink() {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkInput(false);
      return;
    }
    if (!/^(https?|mailto):/i.test(trimmed)) {
      setLinkError('La dirección debe comenzar con https://, http:// o mailto:');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    setShowLinkInput(false);
    setLinkError(null);
  }

  function handleRemoveLink() {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setShowLinkInput(false);
    setLinkError(null);
  }

  // Fallback para entornos SSR / pruebas estáticas sin DOM completo
  if (!editor) {
    return (
      <div className="rich-editor" id={id}>
        <div
          className="rich-editor__content"
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    );
  }

  return (
    <div className={`rich-editor ${disabled ? 'rich-editor--disabled' : ''}`} id={id}>
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Herramientas de formato">
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          aria-label="Negrita"
          aria-pressed={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          aria-label="Cursiva"
          aria-pressed={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          aria-label="Subrayado"
          aria-pressed={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          aria-label="Tachado"
          aria-pressed={editor.isActive('strike')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </button>

        <span className="rich-editor__separator" aria-hidden="true" />

        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
          aria-label="Título 1"
          aria-pressed={editor.isActive('heading', { level: 1 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
          aria-label="Título 2"
          aria-pressed={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
          aria-label="Título 3"
          aria-pressed={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>

        <span className="rich-editor__separator" aria-hidden="true" />

        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
          aria-label="Lista con viñetas"
          aria-pressed={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
          aria-label="Lista numerada"
          aria-pressed={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </button>
        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
          aria-label="Cita en bloque"
          aria-pressed={editor.isActive('blockquote')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          &ldquo; Cita
        </button>

        <span className="rich-editor__separator" aria-hidden="true" />

        <button
          type="button"
          className={`rich-editor__btn ${editor.isActive('link') ? 'is-active' : ''}`}
          aria-label="Enlace web"
          aria-pressed={editor.isActive('link')}
          disabled={disabled}
          onClick={handleOpenLinkDialog}
        >
          Enlace
        </button>
      </div>

      {showLinkInput && (
        <div className="rich-editor__link-dialog" role="dialog" aria-label="Insertar o editar enlace">
          <input
            type="url"
            className="input input--sm"
            aria-label="URL del enlace"
            placeholder="https://ejemplo.com o mailto:..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyLink();
              } else if (e.key === 'Escape') {
                setShowLinkInput(false);
              }
            }}
          />
          <button type="button" className="btn btn--sm" onClick={handleApplyLink}>
            Aplicar
          </button>
          {editor.isActive('link') && (
            <button type="button" className="btn btn--sm btn--subtle" onClick={handleRemoveLink}>
              Quitar
            </button>
          )}
          <button
            type="button"
            className="btn btn--sm btn--subtle"
            onClick={() => setShowLinkInput(false)}
          >
            Cancelar
          </button>
          {linkError && <p className="rich-editor__link-error">{linkError}</p>}
        </div>
      )}

      <div
        className="rich-editor__content-wrapper"
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
      >
        <EditorContent editor={editor} className="rich-editor__content" />
      </div>
    </div>
  );
}
