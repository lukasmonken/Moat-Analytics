import { useEffect, useState } from 'react';
import { loadRiskFreeRate, type RiskFreeRate } from './riskFreeRate';

export type RiskFreeRateState =
  { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; rate: RiskFreeRate };

export function useRiskFreeRate() {
  const [state, setState] = useState<RiskFreeRateState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadRiskFreeRate(signal).then(
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
