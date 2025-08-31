/**
 * useFormValidation Hook
 * 
 * Provides reusable form validation logic for common fields.
 * Supports both synchronous and asynchronous validation.
 */

import { useState, useCallback, useEffect } from 'react';

// Validation rule types
type ValidationRule<T> = {
  test: (value: T) => boolean | Promise<boolean>;
  message: string;
};

type FieldValidation<T> = {
  required?: boolean;
  rules?: ValidationRule<T>[];
};

type ValidationSchema<T extends Record<string, any>> = {
  [K in keyof T]?: FieldValidation<T[K]>;
};

type FormErrors<T extends Record<string, any>> = {
  [K in keyof T]?: string;
};

type TouchedFields<T extends Record<string, any>> = {
  [K in keyof T]?: boolean;
};

// Common validation patterns
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  zip: /^\d{5}(-\d{4})?$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
} as const;

// Common validation rules
export const CommonValidators = {
  email: {
    test: (value: string) => ValidationPatterns.email.test(value),
    message: 'Please enter a valid email address',
  },
  phone: {
    test: (value: string) => ValidationPatterns.phone.test(value.replace(/\D/g, '')),
    message: 'Please enter a valid phone number',
  },
  zip: {
    test: (value: string) => ValidationPatterns.zip.test(value),
    message: 'Please enter a valid ZIP code',
  },
  url: {
    test: (value: string) => ValidationPatterns.url.test(value),
    message: 'Please enter a valid URL',
  },
  minLength: (min: number) => ({
    test: (value: string) => value.length >= min,
    message: `Must be at least ${min} characters`,
  }),
  maxLength: (max: number) => ({
    test: (value: string) => value.length <= max,
    message: `Must be no more than ${max} characters`,
  }),
  minValue: (min: number) => ({
    test: (value: number) => value >= min,
    message: `Must be at least ${min}`,
  }),
  maxValue: (max: number) => ({
    test: (value: number) => value <= max,
    message: `Must be no more than ${max}`,
  }),
  matches: (pattern: RegExp, message?: string) => ({
    test: (value: string) => pattern.test(value),
    message: message || 'Invalid format',
  }),
};

/**
 * Custom hook for form validation
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationSchema: ValidationSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<TouchedFields<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Validate a single field
  const validateField = useCallback(
    async <K extends keyof T>(field: K, value: T[K]): Promise<string | undefined> => {
      const fieldValidation = validationSchema[field];
      if (!fieldValidation) return undefined;

      // Check required
      if (fieldValidation.required) {
        if (!value || (typeof value === 'string' && !value.trim())) {
          return 'This field is required';
        }
      }

      // Check custom rules
      if (fieldValidation.rules) {
        for (const rule of fieldValidation.rules) {
          try {
            const isValid = await rule.test(value);
            if (!isValid) {
              return rule.message;
            }
          } catch (error) {
            console.error(`Validation error for field ${String(field)}:`, error);
            return 'Validation error occurred';
          }
        }
      }

      return undefined;
    },
    [validationSchema]
  );

  // Validate all fields
  const validateForm = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    const newErrors: FormErrors<T> = {};
    
    for (const field of Object.keys(values) as Array<keyof T>) {
      const error = await validateField(field, values[field]);
      if (error) {
        newErrors[field] = error;
      }
    }

    setErrors(newErrors);
    setIsValidating(false);
    return Object.keys(newErrors).length === 0;
  }, [values, validateField]);

  // Handle field change
  const handleChange = useCallback(
    <K extends keyof T>(field: K) => async (value: T[K]) => {
      setValues(prev => ({ ...prev, [field]: value }));
      
      // Validate on change if field was touched
      if (touched[field]) {
        const error = await validateField(field, value);
        setErrors(prev => ({
          ...prev,
          [field]: error,
        }));
      }
    },
    [touched, validateField]
  );

  // Handle field blur
  const handleBlur = useCallback(
    <K extends keyof T>(field: K) => async () => {
      setTouched(prev => ({ ...prev, [field]: true }));
      
      const error = await validateField(field, values[field]);
      setErrors(prev => ({
        ...prev,
        [field]: error,
      }));
    },
    [values, validateField]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Set field value manually
  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  // Set field error manually
  const setFieldError = useCallback(
    <K extends keyof T>(field: K, error: string) => {
      setErrors(prev => ({ ...prev, [field]: error }));
    },
    []
  );

  // Touch field manually
  const touchField = useCallback(
    <K extends keyof T>(field: K) => {
      setTouched(prev => ({ ...prev, [field]: true }));
    },
    []
  );

  // Get field props (for easy integration with inputs)
  const getFieldProps = useCallback(
    <K extends keyof T>(field: K) => ({
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        handleChange(field)(e.target.value as T[K]),
      onBlur: () => handleBlur(field)(),
      error: touched[field] ? errors[field] : undefined,
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  // Check if form is valid
  const isValid = Object.keys(errors).length === 0 && Object.keys(touched).length > 0;

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid,
    setValues,
    setFieldValue,
    setFieldError,
    touchField,
    handleChange,
    handleBlur,
    getFieldProps,
    validateField,
    validateForm,
    resetForm,
    setIsSubmitting,
  };
}

/**
 * Customer form validation schema
 */
export const customerValidationSchema: ValidationSchema<any> = {
  name: {
    required: true,
    rules: [
      CommonValidators.minLength(2),
      CommonValidators.maxLength(100),
    ],
  },
  email: {
    required: true,
    rules: [CommonValidators.email],
  },
  phone: {
    required: true,
    rules: [CommonValidators.phone],
  },
  address: {
    required: true,
    rules: [CommonValidators.minLength(10)],
  },
  customerType: {
    required: true,
  },
  reference: {
    required: true,
  },
};

/**
 * Job form validation schema
 */
export const jobValidationSchema: ValidationSchema<any> = {
  title: {
    required: true,
    rules: [
      CommonValidators.minLength(3),
      CommonValidators.maxLength(100),
    ],
  },
  description: {
    rules: [CommonValidators.maxLength(1000)],
  },
  customerId: {
    required: true,
  },
};

/**
 * Address validation with geocoding
 */
export const createAddressValidator = (geocodingService: any) => ({
  test: async (value: string) => {
    if (!value || value.length < 10) return false;
    
    try {
      const suggestions = await geocodingService.searchAddresses(value);
      return suggestions.length > 0;
    } catch {
      return true; // Allow if geocoding service is unavailable
    }
  },
  message: 'Please enter a valid address',
});