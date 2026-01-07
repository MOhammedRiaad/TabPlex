import React, { useState } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import './AddFolderForm.css';

interface AddFolderFormProps {
    boardId?: string;
}

const AddFolderForm: React.FC<AddFolderFormProps> = ({ boardId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3b82f6'); // Default blue
    const addFolder = useBoardStore(state => state.addFolder);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && boardId) {
            addFolder({
                id: `folder_${Date.now()}`,
                name: name.trim(),
                boardId,
                color,
                order: 0,
            });
            setName('');
            setIsExpanded(false);
        }
    };

    if (!isExpanded) {
        return (
            <button className="add-folder-btn" onClick={() => setIsExpanded(true)}>
                + Add Folder
            </button>
        );
    }

    return (
        <div className="add-folder-form">
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Folder name"
                    autoFocus
                />
                <div className="color-picker">
                    <label>Color:</label>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} />
                </div>
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

export default AddFolderForm;
