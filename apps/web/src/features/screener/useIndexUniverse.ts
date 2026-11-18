import type { IndexUniverseSnapshot } from '@moat/data-contracts';
import { useEffect, useState } from 'react';
import { hasIndexUniverse, loadIndexUniverse } from '../../shared/data-client/indexUniverse';

type UniverseState =
  | { status: 'loading' | 'unavailable' | 'error' }
  | { status: 'ready'; snapshot: IndexUniverseSnapshot };

export function useIndexUniverse() {
  const [state, setState] = useState<UniverseState>({
    status: hasIndexUniverse ? 'loading' : 'unavailable',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hasIndexUniverse) return;

    const controller = new AbortController();
    const { signal } = controller;
    void loadIndexUniverse(signal).then(
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
