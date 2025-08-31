/**
 * SearchBar Component
 * 
 * Reusable search input component with debouncing support.
 */

import React, { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceDelay?: number;
  onSearch?: (value: string) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  showClearButton?: boolean;
  showSearchIcon?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  debounceDelay = 300,
  onSearch,
  style,
  inputStyle,
  showClearButton = true,
  showSearchIcon = true,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, debounceDelay);

  // Update parent when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
      onSearch?.(debouncedValue);
    }
  }, [debouncedValue, value, onChange, onSearch]);

  // Sync with parent value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    onSearch?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onChange(localValue);
      onSearch?.(localValue);
    }
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      {showSearchIcon && (
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#9CA3AF',
          pointerEvents: 'none'
        }}>
          🔍
        </div>
      )}
      
      <input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          padding: '12px',
          paddingLeft: showSearchIcon ? '40px' : '12px',
          paddingRight: showClearButton && localValue ? '40px' : '12px',
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          fontSize: '18.4px',
          transition: 'border-color 0.2s',
          ...inputStyle
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#3B82F6';
          e.currentTarget.style.outline = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#D1D5DB';
        }}
      />
      
      {showClearButton && localValue && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: '#6B7280',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '18px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};