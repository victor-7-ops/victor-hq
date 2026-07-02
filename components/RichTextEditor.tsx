'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { useEffect, useCallback, useRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon,
  Table as TableIcon, Minus, Undo2, Redo2,
  Smile,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '5px',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--text-quaternary)' : 'var(--text-secondary)',
        transition: 'all 100ms ease-out',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: '1px',
        height: '18px',
        background: 'var(--separator)',
        margin: '0 4px',
        flexShrink: 0,
      }}
    />
  );
}

const ICON_SIZE = 14;

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const emojiInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { style: 'max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0;' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    immediatelyRender: false,
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        style: [
          'flex: 1',
          'outline: none',
          'font-size: 14px',
          'line-height: 1.8',
          'color: var(--text-primary)',
          'padding: 16px',
          'overflow-y: auto',
        ].join('; '),
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  const addImageFromUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url, alt: '' }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertEmoji = useCallback(() => {
    emojiInputRef.current?.click();
  }, []);

  const handleEmojiInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return;
    const val = e.target.value;
    if (val) {
      editor.chain().focus().insertContent(val).run();
    }
    e.target.value = '';
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '1px solid var(--separator)',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--separator)',
          background: 'var(--fill-quaternary)',
          flexWrap: 'wrap',
          minHeight: '40px',
        }}
      >
        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo2 size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo2 size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Inline formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
          <Quote size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Insert items */}
        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Add link">
          <LinkIcon size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Upload image">
          <ImageIcon size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={insertTable} title="Insert table">
          <TableIcon size={ICON_SIZE} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus size={ICON_SIZE} />
        </ToolbarButton>

        {/* Emoji - hidden file input trick for native emoji picker isn't reliable, so we use a simple approach */}
        <ToolbarButton onClick={insertEmoji} title="Insert emoji">
          <Smile size={ICON_SIZE} />
        </ToolbarButton>
        <input
          ref={emojiInputRef}
          type="text"
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
          onChange={handleEmojiInput}
        />
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      />

      {/* Editor styles */}
      <style>{`
        .tiptap {
          flex: 1;
          outline: none;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-quaternary);
          pointer-events: none;
          height: 0;
        }
        .tiptap h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 16px 0 8px;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }
        .tiptap h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 14px 0 6px;
          color: var(--text-primary);
          letter-spacing: -0.2px;
        }
        .tiptap h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 12px 0 4px;
          color: var(--text-primary);
        }
        .tiptap p {
          margin: 4px 0;
        }
        .tiptap ul, .tiptap ol {
          padding-left: 24px;
          margin: 4px 0;
        }
        .tiptap li {
          margin: 2px 0;
        }
        .tiptap blockquote {
          border-left: 3px solid var(--accent);
          padding-left: 12px;
          margin: 8px 0;
          color: var(--text-secondary);
          font-style: italic;
        }
        .tiptap code {
          background: var(--fill-quaternary);
          padding: 2px 5px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.9em;
          color: var(--accent);
        }
        .tiptap pre {
          background: var(--fill-quaternary);
          padding: 12px 16px;
          border-radius: 6px;
          margin: 8px 0;
          overflow-x: auto;
        }
        .tiptap pre code {
          background: none;
          padding: 0;
          border-radius: 0;
          color: var(--text-primary);
        }
        .tiptap a {
          color: var(--accent);
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 8px 0;
        }
        .tiptap hr {
          border: none;
          border-top: 1px solid var(--separator);
          margin: 16px 0;
        }
        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 12px 0;
        }
        .tiptap th, .tiptap td {
          border: 1px solid var(--separator);
          padding: 8px 12px;
          text-align: left;
          font-size: 13px;
        }
        .tiptap th {
          background: var(--fill-quaternary);
          font-weight: 600;
          color: var(--text-primary);
        }
        .tiptap td {
          color: var(--text-secondary);
        }
        .tiptap .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-quaternary);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
