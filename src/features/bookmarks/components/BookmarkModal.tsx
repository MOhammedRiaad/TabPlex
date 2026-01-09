import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bookmark } from '../../../types';
import '../BookmarkView.css';

/**
 * BookmarkModal Component
 *
 * A unified modal for creating and editing bookmarks and folders.
 * Follows Material Design principles with proper focus management,
 * keyboard navigation, and accessibility.
 *
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback when modal should close
 * @param mode - 'create' | 'edit' - Determines modal behavior
 * @param bookmark - Existing bookmark data (required for edit mode)
 * @param isFolder - Whether creating/editing a folder
 * @param folders - Available folders for parent selection
 * @param onSubmit - Callback when form is submitted
 * @param onShowToast - Optional toast notification callback
 */
interface BookmarkModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    bookmark?: Bookmark;
    isFolder?: boolean;
    folders?: Bookmark[];
    onSubmit: (data: { title: string; url?: string; parentId?: string }) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const BookmarkModal: React.FC<BookmarkModalProps> = ({
    isOpen,
    onClose,
    mode,
    bookmark,
    isFolder = false,
    folders = [],
    onSubmit,
    onShowToast,
}) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Initialize form data when modal opens or bookmark changes
    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && bookmark) {
                setTitle(bookmark.title || '');
                setUrl(bookmark.url || '');
                setParentId(bookmark.parentId || '');
            } else {
                // Reset for create mode
                setTitle('');
                setUrl('');
                setParentId('');
            }
            setErrors({});
            setIsSubmitting(false);
        }
    }, [isOpen, mode, bookmark]);

    // Focus management: Auto-focus title input when modal opens
    useEffect(() => {
        if (isOpen && titleInputRef.current) {
            // Small delay to ensure modal animation completes
            const timer = setTimeout(() => {
                titleInputRef.current?.focus();
                titleInputRef.current?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Build flat folder list for dropdown (excluding current bookmark if editing)
    const buildFolderOptions = useCallback(() => {
        const options: { id: string; title: string; level: number }[] = [];
        const excludeId = mode === 'edit' && bookmark ? bookmark.id : undefined;

        const traverse = (items: Bookmark[], level = 0) => {
            items.forEach(item => {
                // Skip if it's a bookmark (has URL) or is the item being edited
                if (!item.url && item.id !== excludeId) {
                    options.push({
                        id: item.id,
                        title: '  '.repeat(level) + item.title,
                        level,
                    });
                    // Recursively add children
                    if (item.children && item.children.length > 0) {
                        traverse(item.children, level + 1);
                    }
                }
            });
        };

        traverse(folders);
        return options;
    }, [folders, mode, bookmark]);

    const folderOptions = buildFolderOptions();

    // Validation
    const validate = useCallback((): boolean => {
        const newErrors: { title?: string; url?: string } = {};

        // Title is always required
        if (!title.trim()) {
            newErrors.title = 'Title is required';
        } else if (title.trim().length > 200) {
            newErrors.title = 'Title must be 200 characters or less';
        }

        // URL validation (only for bookmarks, not folders)
        if (!isFolder) {
            if (!url.trim()) {
                newErrors.url = 'URL is required';
            } else {
                try {
                    const urlObj = new URL(url.trim());
                    // Basic URL validation
                    if (
                        !urlObj.protocol ||
                        (!urlObj.protocol.startsWith('http') && !urlObj.protocol.startsWith('file'))
                    ) {
                        newErrors.url = 'URL must start with http://, https://, or file://';
                    }
                } catch {
                    // Try adding https:// if no protocol
                    try {
                        new URL(`https://${url.trim()}`);
                        // Valid URL with https prefix, we'll auto-add it
                    } catch {
                        newErrors.url = 'Please enter a valid URL';
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [title, url, isFolder]);

    // Handle form submission
    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            // Validate and get errors
            const validationErrors: { title?: string; url?: string } = {};

            if (!title.trim()) {
                validationErrors.title = 'Title is required';
            } else if (title.trim().length > 200) {
                validationErrors.title = 'Title must be 200 characters or less';
            }

            if (!isFolder) {
                if (!url.trim()) {
                    validationErrors.url = 'URL is required';
                } else {
                    try {
                        const urlObj = new URL(url.trim());
                        if (
                            !urlObj.protocol ||
                            (!urlObj.protocol.startsWith('http') && !urlObj.protocol.startsWith('file'))
                        ) {
                            validationErrors.url = 'URL must start with http://, https://, or file://';
                        }
                    } catch {
                        try {
                            new URL(`https://${url.trim()}`);
                        } catch {
                            validationErrors.url = 'Please enter a valid URL';
                        }
                    }
                }
            }

            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                // Focus first error field
                setTimeout(() => {
                    if (validationErrors.title && titleInputRef.current) {
                        titleInputRef.current.focus();
                    } else if (validationErrors.url && urlInputRef.current) {
                        urlInputRef.current.focus();
                    }
                }, 0);
                return;
            }

            setErrors({});

            setIsSubmitting(true);

            try {
                // Auto-add https:// if URL doesn't have protocol
                let finalUrl = url.trim();
                if (!isFolder && finalUrl) {
                    try {
                        new URL(finalUrl);
                    } catch {
                        // Invalid URL, try adding https://
                        finalUrl = `https://${finalUrl}`;
                    }
                }

                onSubmit({
                    title: title.trim(),
                    url: isFolder ? undefined : finalUrl,
                    parentId: parentId || undefined,
                });

                onShowToast?.(
                    mode === 'create'
                        ? `${isFolder ? 'Folder' : 'Bookmark'} created successfully!`
                        : `${isFolder ? 'Folder' : 'Bookmark'} updated successfully!`,
                    'success'
                );

                onClose();
            } catch (error) {
                console.error('Error submitting bookmark:', error);
                onShowToast?.(
                    `Failed to ${mode === 'create' ? 'create' : 'update'} ${isFolder ? 'folder' : 'bookmark'}. Please try again.`,
                    'error'
                );
            } finally {
                setIsSubmitting(false);
            }
        },
        [title, url, parentId, isFolder, mode, validate, onSubmit, onClose, onShowToast, errors]
    );

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

    // Prevent body scroll when modal is open
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

    if (!isOpen) return null;

    const modalTitle =
        mode === 'create' ? `Create ${isFolder ? 'Folder' : 'Bookmark'}` : `Edit ${isFolder ? 'Folder' : 'Bookmark'}`;

    return (
        <div
            ref={overlayRef}
            className="bookmark-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookmark-modal-title"
        >
            <div ref={modalRef} className="bookmark-modal-content">
                <div className="bookmark-modal-header">
                    <h2 id="bookmark-modal-title" className="bookmark-modal-title">
                        {modalTitle}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bookmark-modal-close"
                        aria-label="Close modal"
                        disabled={isSubmitting}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="bookmark-modal-form" noValidate>
                    {/* Title Input */}
                    <div className="bookmark-modal-field">
                        <label htmlFor="bookmark-title" className="bookmark-modal-label">
                            Title <span className="bookmark-modal-required">*</span>
                        </label>
                        <input
                            ref={titleInputRef}
                            id="bookmark-title"
                            type="text"
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                if (errors.title) {
                                    setErrors(prev => ({ ...prev, title: undefined }));
                                }
                            }}
                            className={`bookmark-modal-input ${errors.title ? 'bookmark-modal-input-error' : ''}`}
                            placeholder={isFolder ? 'Enter folder name' : 'Enter bookmark title'}
                            maxLength={200}
                            required
                            disabled={isSubmitting}
                            aria-invalid={!!errors.title}
                            aria-describedby={errors.title ? 'title-error' : undefined}
                        />
                        {errors.title && (
                            <span id="title-error" className="bookmark-modal-error" role="alert">
                                {errors.title}
                            </span>
                        )}
                    </div>

                    {/* URL Input (only for bookmarks) */}
                    {!isFolder && (
                        <div className="bookmark-modal-field">
                            <label htmlFor="bookmark-url" className="bookmark-modal-label">
                                URL <span className="bookmark-modal-required">*</span>
                            </label>
                            <input
                                ref={urlInputRef}
                                id="bookmark-url"
                                type="url"
                                value={url}
                                onChange={e => {
                                    setUrl(e.target.value);
                                    if (errors.url) {
                                        setErrors(prev => ({ ...prev, url: undefined }));
                                    }
                                }}
                                className={`bookmark-modal-input ${errors.url ? 'bookmark-modal-input-error' : ''}`}
                                placeholder="https://example.com"
                                required
                                disabled={isSubmitting}
                                aria-invalid={!!errors.url}
                                aria-describedby={errors.url ? 'url-error' : undefined}
                            />
                            {errors.url && (
                                <span id="url-error" className="bookmark-modal-error" role="alert">
                                    {errors.url}
                                </span>
                            )}
                            <p className="bookmark-modal-hint">
                                We&apos;ll automatically add https:// if you don&apos;t include a protocol
                            </p>
                        </div>
                    )}

                    {/* Parent Folder Selection */}
                    {folderOptions.length > 0 && (
                        <div className="bookmark-modal-field">
                            <label htmlFor="bookmark-parent" className="bookmark-modal-label">
                                Parent Folder
                            </label>
                            <select
                                id="bookmark-parent"
                                value={parentId}
                                onChange={e => setParentId(e.target.value)}
                                className="bookmark-modal-select"
                                disabled={isSubmitting}
                            >
                                <option value="">Root (Top Level)</option>
                                {folderOptions.map(option => (
                                    <option key={option.id} value={option.id}>
                                        {option.title}
                                    </option>
                                ))}
                            </select>
                            <p className="bookmark-modal-hint">
                                Select a folder to organize your {isFolder ? 'folder' : 'bookmark'}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="bookmark-modal-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bookmark-modal-btn bookmark-modal-btn-secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bookmark-modal-btn bookmark-modal-btn-primary"
                            disabled={isSubmitting || !title.trim() || (!isFolder && !url.trim())}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="bookmark-modal-spinner" aria-hidden="true"></span>
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

export default BookmarkModal;
