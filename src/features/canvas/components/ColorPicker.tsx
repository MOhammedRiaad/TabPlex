import React, { useState, useEffect } from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
}

import ReactDOM from 'react-dom';

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [hexInput, setHexInput] = useState(color);
    const [recentColors, setRecentColors] = useState<string[]>([]);

    // Preset colors
    const presetColors = [
        '#000000',
        '#ffffff',
        '#ff0000',
        '#00ff00',
        '#0000ff',
        '#ffff00',
        '#ff00ff',
        '#00ffff',
        '#ff8800',
        '#8800ff',
        '#00ff88',
        '#ff0088',
        '#88ff00',
        '#0088ff',
        '#888888',
        '#ff6b6b',
        '#4ecdc4',
        '#45b7d1',
        '#96ceb4',
        '#ffeaa7',
        '#dfe6e9',
        '#74b9ff',
        '#a29bfe',
        '#fd79a8',
        '#fdcb6e',
    ];

    useEffect(() => {
        setHexInput(color);
    }, [color]);

    // Load recent colors from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('canvas-recent-colors');
        if (saved) {
            try {
                setRecentColors(JSON.parse(saved));
            } catch {
                setRecentColors([]);
            }
        }
    }, []);

    const handleColorChange = (newColor: string) => {
        onChange(newColor);
        setHexInput(newColor);

        // Add to recent colors
        const updated = [newColor, ...recentColors.filter(c => c !== newColor)].slice(0, 10);
        setRecentColors(updated);
        localStorage.setItem('canvas-recent-colors', JSON.stringify(updated));
    };

    const handleHexInput = (value: string) => {
        setHexInput(value);
        // Validate hex color
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            handleColorChange(value);
        }
    };

    return (
        <div className="color-picker-wrapper">
            {label && <label className="color-picker-label">{label}</label>}

            <div className="color-picker-trigger" onClick={() => setShowPicker(!showPicker)}>
                <div className="color-preview" style={{ backgroundColor: color }} title={color} />
                <span className="color-value">{color}</span>
            </div>

            {showPicker &&
                ReactDOM.createPortal(
                    <div className="color-picker-modal-overlay" onClick={() => setShowPicker(false)}>
                        <div className="color-picker-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="color-picker-header">
                                <input
                                    type="text"
                                    className="hex-input"
                                    value={hexInput}
                                    onChange={e => handleHexInput(e.target.value)}
                                    placeholder="#000000"
                                    maxLength={7}
                                />
                                <button className="close-btn" onClick={() => setShowPicker(false)}>
                                    ✕
                                </button>
                            </div>

                            {/* Native color input for advanced picking */}
                            <div className="native-picker">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => handleColorChange(e.target.value)}
                                    className="native-color-input"
                                />
                                <span className="native-picker-label">Advanced Picker</span>
                            </div>

                            {/* Preset colors */}
                            <div className="color-section">
                                <div className="section-title">Preset Colors</div>
                                <div className="color-grid">
                                    {presetColors.map(presetColor => (
                                        <button
                                            key={presetColor}
                                            className={`color-swatch ${color === presetColor ? 'active' : ''}`}
                                            style={{ backgroundColor: presetColor }}
                                            onClick={() => handleColorChange(presetColor)}
                                            title={presetColor}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Recent colors */}
                            {recentColors.length > 0 && (
                                <div className="color-section">
                                    <div className="section-title">Recent Colors</div>
                                    <div className="color-grid">
                                        {recentColors.map((recentColor, index) => (
                                            <button
                                                key={`${recentColor}-${index}`}
                                                className={`color-swatch ${color === recentColor ? 'active' : ''}`}
                                                style={{ backgroundColor: recentColor }}
                                                onClick={() => handleColorChange(recentColor)}
                                                title={recentColor}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default ColorPicker;
