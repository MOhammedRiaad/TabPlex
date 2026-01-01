import React, { useState, useRef, useCallback } from 'react';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: number;
    autoFocus?: boolean;
}

// Simple markdown parser for preview
const parseMarkdown = (text: string): string => {
    let html = text
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Code blocks (must be before inline code)
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Unordered lists
        .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
        // Checkboxes
        .replace(/^\s*\[x\] (.+)$/gm, '<div class="checkbox checked">☑ $1</div>')
        .replace(/^\s*\[ \] (.+)$/gm, '<div class="checkbox">☐ $1</div>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr />')
        // Line breaks
        .replace(/\n/g, '<br />');

    // Wrap consecutive <li> tags in <ul>
    html = html.replace(/(<li>.*?<\/li>(<br \/>)?)+/g, (match) => {
        return '<ul>' + match.replace(/<br \/>/g, '') + '</ul>';
    });

    // Clean up consecutive blockquotes
    html = html.replace(/(<blockquote>.*?<\/blockquote>(<br \/>)?)+/g, (match) => {
        return match.replace(/<\/blockquote><br \/><blockquote>/g, '<br />');
    });

    return html;
};

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    placeholder = 'Write your note in markdown...',
    minHeight = 150,
    autoFocus = false,
}) => {
    const [isPreview, setIsPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertText = useCallback((before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

        onChange(newText);

        // Restore cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(
                start + before.length,
                start + before.length + selectedText.length
            );
        }, 0);
    }, [value, onChange]);

    const handleToolbarClick = (action: string) => {
        switch (action) {
            case 'bold':
                insertText('**', '**');
                break;
            case 'italic':
                insertText('*', '*');
                break;
            case 'strikethrough':
                insertText('~~', '~~');
                break;
            case 'code':
                insertText('`', '`');
                break;
            case 'codeblock':
                insertText('```\n', '\n```');
                break;
            case 'link':
                insertText('[', '](url)');
                break;
            case 'h1':
                insertText('# ', '');
                break;
            case 'h2':
                insertText('## ', '');
                break;
            case 'h3':
                insertText('### ', '');
                break;
            case 'ul':
                insertText('- ', '');
                break;
            case 'ol':
                insertText('1. ', '');
                break;
            case 'checkbox':
                insertText('[ ] ', '');
                break;
            case 'quote':
                insertText('> ', '');
                break;
            case 'hr':
                insertText('\n---\n', '');
                break;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Tab handling for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            insertText('  ', '');
        }

        // Ctrl/Cmd + B for bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            handleToolbarClick('bold');
        }

        // Ctrl/Cmd + I for italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            handleToolbarClick('italic');
        }
    };

    return (
        <div className="markdown-editor">
            <div className="editor-toolbar">
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('bold')}
                        title="Bold (Ctrl+B)"
                        className="toolbar-btn"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('italic')}
                        title="Italic (Ctrl+I)"
                        className="toolbar-btn"
                    >
                        <em>I</em>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('strikethrough')}
                        title="Strikethrough"
                        className="toolbar-btn"
                    >
                        <del>S</del>
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('h1')}
                        title="Heading 1"
                        className="toolbar-btn"
                    >
                        H1
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('h2')}
                        title="Heading 2"
                        className="toolbar-btn"
                    >
                        H2
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('h3')}
                        title="Heading 3"
                        className="toolbar-btn"
                    >
                        H3
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('ul')}
                        title="Bullet List"
                        className="toolbar-btn"
                    >
                        •
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('ol')}
                        title="Numbered List"
                        className="toolbar-btn"
                    >
                        1.
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('checkbox')}
                        title="Checkbox"
                        className="toolbar-btn"
                    >
                        ☑
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('code')}
                        title="Inline Code"
                        className="toolbar-btn"
                    >
                        {'</>'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('codeblock')}
                        title="Code Block"
                        className="toolbar-btn"
                    >
                        {'{ }'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('link')}
                        title="Link"
                        className="toolbar-btn"
                    >
                        🔗
                    </button>
                    <button
                        type="button"
                        onClick={() => handleToolbarClick('quote')}
                        title="Quote"
                        className="toolbar-btn"
                    >
                        "
                    </button>
                </div>

                <div className="toolbar-spacer" />

                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => setIsPreview(!isPreview)}
                        className={`toolbar-btn preview-toggle ${isPreview ? 'active' : ''}`}
                        title={isPreview ? 'Edit' : 'Preview'}
                    >
                        {isPreview ? '✏️ Edit' : '👁️ Preview'}
                    </button>
                </div>
            </div>

            <div className="editor-content" style={{ minHeight }}>
                {isPreview ? (
                    <div
                        className="markdown-preview"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(value) || '<em class="empty-preview">Nothing to preview</em>' }}
                    />
                ) : (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="markdown-textarea"
                        style={{ minHeight }}
                        autoFocus={autoFocus}
                    />
                )}
            </div>

            <div className="editor-footer">
                <span className="editor-hint">
                    Supports Markdown: **bold**, *italic*, `code`, # headings, - lists, [ ] checkboxes
                </span>
                <span className="char-count">{value.length} characters</span>
            </div>
        </div>
    );
};

export default MarkdownEditor;
