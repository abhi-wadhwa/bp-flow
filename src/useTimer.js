import { useState, useRef, useCallback } from 'react';
import { SPEECH_DURATION } from './constants';

export function useTimer() {
  const [timers, setTimers] = useState({});
  const intervalsRef = useRef({});

  const getTimer = useCallback((speakerIndex) => {
    return timers[speakerIndex] || { elapsed: 0, running: false };
  }, [timers]);

  const toggleTimer = useCallback((speakerIndex) => {
    setTimers(prev => {
      const current = prev[speakerIndex] || { elapsed: 0, running: false };
      const newRunning = !current.running;

      if (newRunning) {
        const startTime = Date.now() - current.elapsed * 1000;
        intervalsRef.current[speakerIndex] = setInterval(() => {
          setTimers(p => {
            const elapsed = Math.min((Date.now() - startTime) / 1000, SPEECH_DURATION);
            return {
              ...p,
              [speakerIndex]: { ...p[speakerIndex], elapsed },
            };
          });
        }, 100);
      } else {
        clearInterval(intervalsRef.current[speakerIndex]);
      }

      return {
        ...prev,
        [speakerIndex]: { ...current, running: newRunning },
      };
    });
  }, []);

  const resetTimer = useCallback((speakerIndex) => {
    clearInterval(intervalsRef.current[speakerIndex]);
    setTimers(prev => ({
      ...prev,
      [speakerIndex]: { elapsed: 0, running: false },
    }));
  }, []);

  const pauseTimer = useCallback((speakerIndex) => {
    if (intervalsRef.current[speakerIndex]) {
      clearInterval(intervalsRef.current[speakerIndex]);
    }
    setTimers(prev => {
      const current = prev[speakerIndex];
      if (!current || !current.running) return prev;
      return {
        ...prev,
        [speakerIndex]: { ...current, running: false },
      };
    });
  }, []);

  return { getTimer, toggleTimer, resetTimer, pauseTimer };
}
