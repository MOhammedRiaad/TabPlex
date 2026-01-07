import React, { useState } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import './AddTabForm.css';

interface AddTabFormProps {
    folderId?: string;
}

const AddTabForm: React.FC<AddTabFormProps> = ({ folderId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const addTab = useBoardStore(state => state.addTab);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim() && url.trim() && folderId) {
            addTab({
                id: `tab_${Date.now()}`,
                title: title.trim(),
                url: url.trim(),
                folderId,
                favicon: '',
                tabId: null,
                lastAccessed: new Date().toISOString(),
                status: 'open',
            });
            setTitle('');
            setUrl('');
            setIsExpanded(false);
        }
    };

    if (!isExpanded) {
        return (
            <button className="add-tab-btn" onClick={() => setIsExpanded(true)}>
                + Add Tab
            </button>
        );
    }

    return (
        <div className="add-tab-form">
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Tab title"
                    autoFocus
                />
                <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL" />
                <div className="form-actions">
                    <button type="submit">Add</button>
                    <button type="button" onClick={() => setIsExpanded(false)}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddTabForm;
