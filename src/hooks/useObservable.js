import { useState, useEffect } from 'react';

export function useObservable(observable$, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const subscription = observable$.subscribe((newValue) => {
      setValue(newValue);
    });
    return () => subscription.unsubscribe();
  }, [observable$]);

  return value;
}
