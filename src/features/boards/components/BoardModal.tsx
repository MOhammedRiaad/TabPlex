import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, Tab } from '../../../types';
import { normalizeUrl, validateRequiredText, validateUrl } from '../../../utils/formValidation';
import '../BoardView.css';

interface BoardModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    type: 'folder' | 'tab';
    folder?: Folder;
    tab?: Tab;
    folders?: Folder[];
    initialFolderId?: string;
    onSubmit: (data: { name?: string; title?: string; url?: string; color?: string; folderId?: string }) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const BoardModal: React.FC<BoardModalProps> = ({
    isOpen,
    onClose,
    mode,
    type,
    folder,
    tab,
    folders = [],
    initialFolderId,
    onSubmit,
    onShowToast,
}) => {
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [folderId, setFolderId] = useState<string>('');
    const [errors, setErrors] = useState<{ name?: string; title?: string; url?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Initialize form data
    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit') {
                if (type === 'folder' && folder) {
                    setName(folder.name || '');
                    setColor(folder.color || '#3b82f6');
                } else if (type === 'tab' && tab) {
                    setTitle(tab.title || '');
                    setUrl(tab.url || '');
                    setFolderId(tab.folderId || '');
                }
            } else {
                setName('');
                setTitle('');
                setUrl('');
                setColor('#3b82f6');
                setFolderId(initialFolderId || '');
            }
            setErrors({});
            setIsSubmitting(false);
        }
    }, [isOpen, mode, type, folder, tab, initialFolderId]);

    // Focus management
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                if (type === 'folder' && nameInputRef.current) {
                    nameInputRef.current.focus();
                    nameInputRef.current.select();
                } else if (type === 'tab' && titleInputRef.current) {
                    titleInputRef.current.focus();
                    titleInputRef.current.select();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, type]);

    // Handle Escape key and click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                onClose();
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (overlayRef.current && e.target === overlayRef.current && !isSubmitting) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isSubmitting, onClose]);

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            const newErrors: { name?: string; title?: string; url?: string } =
                type === 'folder'
                    ? { name: validateRequiredText(name, 'Name', 100) }
                    : { title: validateRequiredText(title, 'Title', 200), url: validateUrl(url) };
            (Object.keys(newErrors) as (keyof typeof newErrors)[]).forEach(key => {
                if (!newErrors[key]) delete newErrors[key];
            });

            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                setTimeout(() => {
                    if (newErrors.name && nameInputRef.current) {
                        nameInputRef.current.focus();
                    } else if (newErrors.title && titleInputRef.current) {
                        titleInputRef.current.focus();
                    } else if (newErrors.url && urlInputRef.current) {
                        urlInputRef.current.focus();
                    }
                }, 0);
                return;
            }

            setErrors({});
            setIsSubmitting(true);

            try {
                const finalUrl = normalizeUrl(url);
                onSubmit({
                    name: type === 'folder' ? name.trim() : undefined,
                    title: type === 'tab' ? title.trim() : undefined,
                    url: type === 'tab' ? finalUrl : undefined,
                    color: type === 'folder' ? color : undefined,
                    folderId: type === 'tab' ? folderId || '' : undefined,
                });

                onShowToast?.(
                    mode === 'create'
                        ? `${type === 'folder' ? 'Folder' : 'Tab'} created successfully!`
                        : `${type === 'folder' ? 'Folder' : 'Tab'} updated successfully!`,
                    'success'
                );

                onClose();
            } catch (error) {
                console.error('Error submitting:', error);
                onShowToast?.(
                    `Failed to ${mode === 'create' ? 'create' : 'update'} ${type === 'folder' ? 'folder' : 'tab'}. Please try again.`,
                    'error'
                );
            } finally {
                setIsSubmitting(false);
            }
        },
        [name, title, url, color, folderId, type, mode, onSubmit, onClose, onShowToast]
    );

    if (!isOpen) return null;

    const modalTitle =
        mode === 'create'
            ? `Create ${type === 'folder' ? 'Folder' : 'Tab'}`
            : `Edit ${type === 'folder' ? 'Folder' : 'Tab'}`;

    return (
        <div
            ref={overlayRef}
            className="board-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="board-modal-title"
        >
            <div ref={modalRef} className="board-modal-content">
                <div className="board-modal-header">
                    <h2 id="board-modal-title" className="board-modal-title">
                        {modalTitle}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="board-modal-close"
                        aria-label="Close modal"
                        disabled={isSubmitting}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="board-modal-form" noValidate>
                    {type === 'folder' ? (
                        <>
                            <div className="board-modal-field">
                                <label htmlFor="board-folder-name" className="board-modal-label">
                                    Name <span className="board-modal-required">*</span>
                                </label>
                                <input
                                    ref={nameInputRef}
                                    id="board-folder-name"
                                    type="text"
                                    value={name}
                                    onChange={e => {
                                        setName(e.target.value);
                                        if (errors.name) {
                                            setErrors(prev => ({ ...prev, name: undefined }));
                                        }
                                    }}
                                    className={`board-modal-input ${errors.name ? 'board-modal-input-error' : ''}`}
                                    placeholder="Enter folder name"
                                    maxLength={100}
                                    required
                                    disabled={isSubmitting}
                                    aria-invalid={!!errors.name}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                />
                                {errors.name && (
                                    <span id="name-error" className="board-modal-error" role="alert">
                                        {errors.name}
                                    </span>
                                )}
                            </div>

                            <div className="board-modal-field">
                                <label htmlFor="board-folder-color" className="board-modal-label">
                                    Color
                                </label>
                                <input
                                    id="board-folder-color"
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="board-modal-color-input"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="board-modal-field">
                                <label htmlFor="board-tab-title" className="board-modal-label">
                                    Title <span className="board-modal-required">*</span>
                                </label>
                                <input
                                    ref={titleInputRef}
                                    id="board-tab-title"
                                    type="text"
                                    value={title}
                                    onChange={e => {
                                        setTitle(e.target.value);
                                        if (errors.title) {
                                            setErrors(prev => ({ ...prev, title: undefined }));
                                        }
                                    }}
                                    className={`board-modal-input ${errors.title ? 'board-modal-input-error' : ''}`}
                                    placeholder="Enter tab title"
                                    maxLength={200}
                                    required
                                    disabled={isSubmitting}
                                    aria-invalid={!!errors.title}
                                    aria-describedby={errors.title ? 'title-error' : undefined}
                                />
                                {errors.title && (
                                    <span id="title-error" className="board-modal-error" role="alert">
                                        {errors.title}
                                    </span>
                                )}
                            </div>

                            <div className="board-modal-field">
                                <label htmlFor="board-tab-url" className="board-modal-label">
                                    URL <span className="board-modal-required">*</span>
                                </label>
                                <input
                                    ref={urlInputRef}
                                    id="board-tab-url"
                                    type="url"
                                    value={url}
                                    onChange={e => {
                                        setUrl(e.target.value);
                                        if (errors.url) {
                                            setErrors(prev => ({ ...prev, url: undefined }));
                                        }
                                    }}
                                    className={`board-modal-input ${errors.url ? 'board-modal-input-error' : ''}`}
                                    placeholder="https://example.com"
                                    required
                                    disabled={isSubmitting}
                                    aria-invalid={!!errors.url}
                                    aria-describedby={errors.url ? 'url-error' : undefined}
                                />
                                {errors.url && (
                                    <span id="url-error" className="board-modal-error" role="alert">
                                        {errors.url}
                                    </span>
                                )}
                                <p className="board-modal-hint">
                                    We&apos;ll automatically add https:// if you don&apos;t include a protocol
                                </p>
                            </div>

                            {folders.length > 0 && (
                                <div className="board-modal-field">
                                    <label htmlFor="board-tab-folder" className="board-modal-label">
                                        Folder
                                    </label>
                                    <select
                                        id="board-tab-folder"
                                        value={folderId}
                                        onChange={e => setFolderId(e.target.value)}
                                        className="board-modal-select"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">No Folder (Top Level)</option>
                                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>
                                                {f.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    <div className="board-modal-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="board-modal-btn board-modal-btn-secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="board-modal-btn board-modal-btn-primary"
                            disabled={isSubmitting || (type === 'folder' ? !name.trim() : !title.trim() || !url.trim())}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="board-modal-spinner" aria-hidden="true"></span>
                                    {mode === 'create' ? 'Creating...' : 'Saving...'}
                                </>
                            ) : mode === 'create' ? (
                                'Create'
                            ) : (
                                'Save'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BoardModal;
