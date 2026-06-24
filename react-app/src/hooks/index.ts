import { useState, useEffect, useCallback } from 'react';

// Simple useDebounce hook used in Sales.tsx
export function useDebounce<T>(value: T, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// Minimal useAsync: runs an async function and returns { data, loading, error, refetch }
export function useAsync<T = any>(asyncFn: () => Promise<T>, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    const run = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await asyncFn();
            setData(res as T);
            return res;
        } catch (err) {
            setError(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, // eslint-disable-next-line react-hooks/exhaustive-deps
        deps);

    useEffect(() => {
        run();
    }, [run]);

    return { data, loading, error, refetch: run } as const;
}

// Minimal useForm: manages form state and validation
export function useForm<T extends Record<string, any>>(initial: T, validate?: (v: T) => Record<string, any>) {
    const [values, setValues] = useState<T>(initial);
    const [errors, setErrors] = useState<Record<string, any>>({});

    const handleChange = (field: keyof T) => (e: any) => {
        const value = e && e.target !== undefined ? e.target.value : e;
        setValues((prev) => ({ ...prev, [field]: value }));
        if (validate) {
            const errs = validate({ ...values, [field]: value });
            setErrors(errs || {});
        }
    };

    const reset = (next?: T) => {
        setValues(next || initial);
        setErrors({});
    };

    return { values, setValues, errors, setErrors, handleChange, reset } as const;
}

export default {
    useDebounce,
    useAsync,
    useForm,
};
