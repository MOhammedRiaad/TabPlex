import React, { useState } from 'react';
import '../SessionsView.css';

interface CreateSessionFormProps {
    onCreate: (name: string) => void;
}

const CreateSessionForm: React.FC<CreateSessionFormProps> = ({ onCreate }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');

    const handleCreate = () => {
        if (name.trim()) {
            onCreate(name);
            setName('');
            setIsCreating(false);
        }
    };

    const handleCancel = () => {
        setIsCreating(false);
        setName('');
    };

    return (
        <div className="create-session-form">
            {isCreating ? (
                <div className="session-input-group">
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Enter session name"
                        className="session-input"
                        autoFocus
                    />
                    <button onClick={handleCreate} className="btn-confirm">
                        Create
                    </button>
                    <button onClick={handleCancel} className="btn-cancel">
                        Cancel
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsCreating(true)} className="btn-create-session">
                    + Create New Session
                </button>
            )}
        </div>
    );
};

export default CreateSessionForm;
