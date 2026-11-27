import { useEffect, useState } from 'react';
import { loadInflationRate, type InflationRate } from './inflationRate';

export type InflationRateState =
  { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; rate: InflationRate };

export function useInflationRate() {
  const [state, setState] = useState<InflationRateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadInflationRate(signal).then(
      (rate) => {
        if (!signal.aborted)
          setState(rate === null ? { status: 'unavailable' } : { status: 'ready', rate });
      },
      () => {
        if (!signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  function reload() {
    setState({ status: 'loading' });
    setAttempt((last) => last + 1);
  }

  return { state, reload };
}
