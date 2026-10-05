import React, { useId, useState } from 'react';
import { MAX_TAGS, TAG_MAX, addTags } from '../../../utils/tags';
import './Tags.css';

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    /** Tags already in use elsewhere, offered as suggestions */
    suggestions?: string[];
    label?: string;
}

/** Edit a list of tags as chips. Enter or comma adds, Backspace on an empty input removes the last one. */
const TagInput: React.FC<TagInputProps> = ({ tags, onChange, suggestions = [], label = 'Tags' }) => {
    const id = useId();
    const [draft, setDraft] = useState('');

    const commit = (text: string) => {
        if (text.trim()) onChange(addTags(tags, text));
        setDraft('');
    };

    const offered = suggestions.filter(tag => !tags.includes(tag));

    return (
        <div className="tag-input" role="group" aria-label={label}>
            {tags.map(tag => (
                <span key={tag} className="tag-chip">
                    #{tag}
                    <button
                        type="button"
                        className="tag-chip-remove"
                        onClick={() => onChange(tags.filter(t => t !== tag))}
                        aria-label={`Remove tag ${tag}`}
                    >
                        ×
                    </button>
                </span>
            ))}
            {tags.length < MAX_TAGS && (
                <>
                    <input
                        type="text"
                        value={draft}
                        maxLength={TAG_MAX * 3}
                        list={offered.length ? `${id}-suggestions` : undefined}
                        placeholder={tags.length ? 'Add tag' : 'Add tags, e.g. q4, research'}
                        aria-label="Add tag"
                        onChange={e => {
                            const value = e.target.value;
                            // A comma finishes the tag(s) typed so far
                            if (value.includes(',')) commit(value);
                            else setDraft(value);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // add the tag, don't submit the surrounding form
                                commit(draft);
                            } else if (e.key === 'Backspace' && !draft && tags.length) {
                                onChange(tags.slice(0, -1));
                            }
                        }}
                        onBlur={() => commit(draft)}
                    />
                    {offered.length > 0 && (
                        <datalist id={`${id}-suggestions`}>
                            {offered.map(tag => (
                                <option key={tag} value={tag} />
                            ))}
                        </datalist>
                    )}
                </>
            )}
        </div>
    );
};

export default TagInput;

/** Read-only tag chips */
export const TagList: React.FC<{ tags?: string[]; className?: string }> = ({ tags, className }) =>
    tags?.length ? (
        <ul className={`tag-list ${className ?? ''}`} aria-label="Tags">
            {tags.map(tag => (
                <li key={tag} className="tag-chip">
                    #{tag}
                </li>
            ))}
        </ul>
    ) : null;
