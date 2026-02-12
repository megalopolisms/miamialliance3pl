/**
 * Miami Alliance 3PL - Form Validation Module
 * @module form-validation
 * @version 1.0.0
 * @description Unified form validation system with real-time feedback and accessibility support
 */
window.MA3PLForms = (function() {
    'use strict';

    // ============================================================
    // VALIDATION PATTERNS
    // ============================================================

    const patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[\d\s\-\+\(\)]{10,}$/,
        currency: /^\d+(\.\d{1,2})?$/,
        posInt: /^[1-9]\d*$/,
        zip: /^\d{5}(-\d{4})?$/,
        state: /^[A-Z]{2}$/i,
        url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        alphanumeric: /^[a-zA-Z0-9]+$/,
        decimal: /^-?\d+(\.\d+)?$/,
        percentage: /^(100(\.0{1,2})?|[1-9]?\d(\.\d{1,2})?)$/
    };

    // ============================================================
    // ERROR MESSAGES
    // ============================================================

    const messages = {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        currency: 'Please enter a valid amount (e.g., 10.00)',
        posInt: 'Please enter a positive whole number',
        zip: 'Please enter a valid ZIP code',
        state: 'Please enter a valid 2-letter state code',
        url: 'Please enter a valid URL',
        min: 'Value must be at least {min}',
        max: 'Value must be at most {max}',
        minlength: 'Must be at least {minlength} characters',
        maxlength: 'Must be at most {maxlength} characters',
        pattern: 'Please match the requested format',
        mismatch: 'Fields do not match'
    };

    // ============================================================
    // CSS STYLES (injected once)
    // ============================================================

    const styleId = 'ma3pl-form-validation-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .ma3pl-field-error {
                border-color: #dc2626 !important;
                background-color: #fef2f2 !important;
            }
            .ma3pl-field-error:focus {
                box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2) !important;
                outline: none !important;
            }
            .ma3pl-field-valid {
                border-color: #10b981 !important;
            }
            .ma3pl-field-valid:focus {
                box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
            }
            .ma3pl-error-message {
                color: #dc2626;
                font-size: 0.75rem;
                margin-top: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
                animation: ma3pl-shake 0.3s ease;
            }
            .ma3pl-error-message::before {
                content: '';
                display: inline-block;
                width: 12px;
                height: 12px;
                background: #dc2626;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .ma3pl-error-message::before {
                content: '!';
                color: white;
                font-size: 10px;
                font-weight: bold;
                text-align: center;
                line-height: 12px;
            }
            .ma3pl-success-indicator {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: #10b981;
                font-size: 1rem;
            }
            .ma3pl-field-wrapper {
                position: relative;
            }
            @keyframes ma3pl-shake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-5px); }
                40%, 80% { transform: translateX(5px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // VALIDATION FUNCTIONS
    // ============================================================

    /**
     * Validate a single field
     * @param {HTMLElement} field - The form field to validate
     * @returns {Object} - { valid: boolean, message: string }
     */
    function validateField(field) {
        const value = field.value.trim();
        const type = field.type;
        const name = field.name || field.id || 'Field';

        // Check required
        if (field.hasAttribute('required') && !value) {
            return { valid: false, message: messages.required };
        }

        // Skip further validation if empty and not required
        if (!value) {
            return { valid: true, message: '' };
        }

        // Check minlength
        if (field.minLength && field.minLength > 0 && value.length < field.minLength) {
            return { valid: false, message: messages.minlength.replace('{minlength}', field.minLength) };
        }

        // Check maxlength
        if (field.maxLength && field.maxLength > 0 && value.length > field.maxLength) {
            return { valid: false, message: messages.maxlength.replace('{maxlength}', field.maxLength) };
        }

        // Check min (for number inputs)
        if (field.min !== '' && !isNaN(field.min)) {
            const numValue = parseFloat(value);
            if (numValue < parseFloat(field.min)) {
                return { valid: false, message: messages.min.replace('{min}', field.min) };
            }
        }

        // Check max (for number inputs)
        if (field.max !== '' && !isNaN(field.max)) {
            const numValue = parseFloat(value);
            if (numValue > parseFloat(field.max)) {
                return { valid: false, message: messages.max.replace('{max}', field.max) };
            }
        }

        // Check pattern attribute
        if (field.pattern) {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
                return { valid: false, message: field.title || messages.pattern };
            }
        }

        // Check data-validate attribute for custom validation types
        const validateType = field.dataset.validate;
        if (validateType && patterns[validateType]) {
            if (!patterns[validateType].test(value)) {
                return { valid: false, message: messages[validateType] || messages.pattern };
            }
        }

        // Type-specific validation
        switch (type) {
            case 'email':
                if (!patterns.email.test(value)) {
                    return { valid: false, message: messages.email };
                }
                break;
            case 'tel':
                if (!patterns.phone.test(value)) {
                    return { valid: false, message: messages.phone };
                }
                break;
            case 'url':
                if (!patterns.url.test(value)) {
                    return { valid: false, message: messages.url };
                }
                break;
            case 'number':
                if (isNaN(parseFloat(value))) {
                    return { valid: false, message: 'Please enter a valid number' };
                }
                break;
        }

        // Check data-match attribute for password confirmation etc.
        if (field.dataset.match) {
            const matchField = document.getElementById(field.dataset.match);
            if (matchField && matchField.value !== value) {
                return { valid: false, message: messages.mismatch };
            }
        }

        return { valid: true, message: '' };
    }

    /**
     * Validate entire form
     * @param {HTMLFormElement} form - The form to validate
     * @returns {Object} - { valid: boolean, errors: Array<{field, message}> }
     */
    function validate(form) {
        const errors = [];
        const fields = form.querySelectorAll('input, select, textarea');

        fields.forEach(field => {
            // Skip hidden, disabled, or submit fields
            if (field.type === 'hidden' || field.type === 'submit' || field.disabled) {
                return;
            }

            const result = validateField(field);
            if (!result.valid) {
                errors.push({
                    field: field,
                    name: field.name || field.id,
                    message: result.message
                });
                showError(field, result.message);
            } else {
                clearError(field);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Show error styling and message on a field
     * @param {HTMLElement} field - The form field
     * @param {string} message - Error message to display
     */
    function showError(field, message) {
        // Remove any existing error state
        clearError(field);

        // Add error styling
        field.classList.add('ma3pl-field-error');
        field.classList.remove('ma3pl-field-valid');
        field.setAttribute('aria-invalid', 'true');

        // Create and append error message
        const errorEl = document.createElement('div');
        errorEl.className = 'ma3pl-error-message';
        errorEl.id = `${field.id || field.name}-error`;
        errorEl.textContent = message;
        errorEl.setAttribute('role', 'alert');

        // Insert after the field
        field.parentNode.insertBefore(errorEl, field.nextSibling);

        // Link error to field for accessibility
        field.setAttribute('aria-describedby', errorEl.id);
    }

    /**
     * Clear error styling and message from a field
     * @param {HTMLElement} field - The form field
     */
    function clearError(field) {
        field.classList.remove('ma3pl-field-error');
        field.setAttribute('aria-invalid', 'false');
        field.removeAttribute('aria-describedby');

        // Remove existing error message
        const errorId = `${field.id || field.name}-error`;
        const existingError = document.getElementById(errorId);
        if (existingError) {
            existingError.remove();
        }

        // Also check for sibling error messages
        const sibling = field.nextElementSibling;
        if (sibling && sibling.classList.contains('ma3pl-error-message')) {
            sibling.remove();
        }
    }

    /**
     * Show valid state on a field
     * @param {HTMLElement} field - The form field
     */
    function showValid(field) {
        clearError(field);
        if (field.value.trim()) {
            field.classList.add('ma3pl-field-valid');
        }
    }

    /**
     * Setup real-time validation on form fields
     * @param {HTMLFormElement} form - The form to setup
     * @param {Object} options - Configuration options
     */
    function setupRealTimeValidation(form, options = {}) {
        const {
            validateOnBlur = true,
            validateOnInput = false,
            showSuccessState = true,
            debounceMs = 300
        } = options;

        const fields = form.querySelectorAll('input, select, textarea');
        let debounceTimer = null;

        fields.forEach(field => {
            // Skip hidden, disabled, or submit fields
            if (field.type === 'hidden' || field.type === 'submit' || field.disabled) {
                return;
            }

            // Blur validation
            if (validateOnBlur) {
                field.addEventListener('blur', () => {
                    const result = validateField(field);
                    if (!result.valid) {
                        showError(field, result.message);
                    } else if (showSuccessState) {
                        showValid(field);
                    } else {
                        clearError(field);
                    }
                });
            }

            // Input validation (debounced)
            if (validateOnInput) {
                field.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        const result = validateField(field);
                        if (!result.valid) {
                            showError(field, result.message);
                        } else if (showSuccessState) {
                            showValid(field);
                        } else {
                            clearError(field);
                        }
                    }, debounceMs);
                });
            }

            // Clear error on focus (optional UX improvement)
            field.addEventListener('focus', () => {
                if (field.classList.contains('ma3pl-field-error')) {
                    // Keep the error visible but remove shake animation
                    const errorEl = field.nextElementSibling;
                    if (errorEl && errorEl.classList.contains('ma3pl-error-message')) {
                        errorEl.style.animation = 'none';
                    }
                }
            });
        });

        // Prevent form submission if invalid
        form.addEventListener('submit', (e) => {
            const result = validate(form);
            if (!result.valid) {
                e.preventDefault();

                // Focus first invalid field
                if (result.errors.length > 0) {
                    result.errors[0].field.focus();
                }

                // Show toast notification if available
                if (window.MA3PL && window.MA3PL.toast) {
                    window.MA3PL.toast.error('Please fix the errors in the form');
                }

                return false;
            }
        });
    }

    /**
     * Clear all validation states from a form
     * @param {HTMLFormElement} form - The form to clear
     */
    function clearForm(form) {
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            clearError(field);
            field.classList.remove('ma3pl-field-valid');
        });
    }

    /**
     * Add a custom validation pattern
     * @param {string} name - Pattern name
     * @param {RegExp} regex - The regex pattern
     * @param {string} message - Error message
     */
    function addPattern(name, regex, message) {
        patterns[name] = regex;
        messages[name] = message;
    }

    /**
     * Validate a specific field by ID
     * @param {string} fieldId - The field ID
     * @returns {Object} - { valid: boolean, message: string }
     */
    function validateById(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) {
            return { valid: false, message: 'Field not found' };
        }
        const result = validateField(field);
        if (!result.valid) {
            showError(field, result.message);
        } else {
            showValid(field);
        }
        return result;
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        validate,
        validateField,
        validateById,
        showError,
        clearError,
        showValid,
        setupRealTimeValidation,
        clearForm,
        addPattern,
        patterns,
        messages
    };
})();

// Auto-initialize forms with data-validate-form attribute
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-validate-form]').forEach(form => {
        const options = {
            validateOnBlur: form.dataset.validateOnBlur !== 'false',
            validateOnInput: form.dataset.validateOnInput === 'true',
            showSuccessState: form.dataset.showSuccess !== 'false'
        };
        window.MA3PLForms.setupRealTimeValidation(form, options);
    });
});
