import type { CvmSnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { loadCvmSnapshot } from '../../shared/data-client/cvmSnapshot';

type SampleState =
  { status: 'loading' | 'unavailable' | 'error' } | { status: 'ready'; snapshot: CvmSnapshot };

export function useCvmSample() {
  const [state, setState] = useState<SampleState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void loadCvmSnapshot(signal).then(
      (snapshot) => {
        if (signal.aborted) return;
        setState(snapshot ? { status: 'ready', snapshot } : { status: 'unavailable' });
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
