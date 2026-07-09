import React, { useState, useEffect } from 'react';

interface QuantityInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  className,
  placeholder,
  required
}) => {
  const formatValue = (val: number) => {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '';
    if (val % 1 === 0) {
      return val.toString();
    } else {
      // Avoid scientific notation and handle floats gracefully
      const strVal = val.toString();
      return strVal.replace('.', ',');
    }
  };

  const [localValue, setLocalValue] = useState(formatValue(value));

  useEffect(() => {
    const cleanedLocal = localValue.replace(/,/g, '.');
    const parsedLocal = parseFloat(cleanedLocal);
    const localNum = isNaN(parsedLocal) ? 0 : parsedLocal;
    
    if (localNum !== value) {
      setLocalValue(formatValue(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    
    // Replace dots with commas to support decimal separator as comma
    raw = raw.replace(/\./g, ',');
    
    // Filter out invalid characters (only allow digits and comma)
    if (/[^\d,]/.test(raw)) return;
    
    // Allow at most one comma
    const commaCount = (raw.match(/,/g) || []).length;
    if (commaCount > 1) return;

    setLocalValue(raw);

    if (raw === '') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(raw.replace(/,/g, '.'));
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
      required={required}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
