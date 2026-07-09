import React, { useState, useEffect } from 'react';

interface PriceInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export const PriceInput: React.FC<PriceInputProps> = ({ value, onChange, className }) => {
  const formatValue = (val: number) => {
    if (!val) return '';
    let parts = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    parts[0] = parts[0].replace(/,/g, '.');
    return parts.join(',');
  };

  const [localValue, setLocalValue] = useState(formatValue(value));

  useEffect(() => {
    const parsedLocal = parseFloat(localValue.replace(/\./g, '').replace(/,/g, '.'));
    if (parsedLocal !== value && !(isNaN(parsedLocal) && value === 0)) {
      setLocalValue(formatValue(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/[^\d.,]/.test(raw)) return; // prevent typing letters
    
    setLocalValue(raw);
    
    if (raw === '') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(raw.replace(/\./g, '').replace(/,/g, '.'));
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setLocalValue(formatValue(value));
  };

  return (
    <input 
      type="text" 
      inputMode="decimal" 
      value={localValue} 
      onChange={handleChange} 
      onBlur={handleBlur}
      className={className} 
    />
  );
};
