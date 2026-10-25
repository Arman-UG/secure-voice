
'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'secure-voice-recent-calls';

function loadCallHistory() {
  if (typeof window === 'undefined') return [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not load call history:', error);
    return [];
  }
}

export default function useCallHistory() {
  const [recentCalls, setRecentCalls] = useState(loadCallHistory);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(recentCalls)
      );
    } catch (error) {
      console.error('Could not save call history:', error);
    }
  }, [recentCalls]);

  const startCallRecord = useCallback(({
    id,
    name = 'Unknown',
    number,
    direction,
  }) => {
    if (!id || !number) return;

    setRecentCalls((previous) => {
      if (previous.some((call) => call.id === id)) {
        return previous;
      }

      return [
        {
          id,
          name,
          number,
          direction,
          timestamp: Date.now(),
          duration: 0,
          status: 'ringing',
          startedAt: null,
        },
        ...previous,
      ];
    });
  }, []);

  const updateCallRecord = useCallback((id, updates) => {
    if (!id) return;

    setRecentCalls((previous) =>
      previous.map((call) =>
        call.id === id ? { ...call, ...updates } : call
      )
    );
  }, []);

  const markCallConnected = useCallback((id) => {
    if (!id) return;

    setRecentCalls((previous) =>
      previous.map((call) =>
        call.id === id
          ? {
              ...call,
              status: 'completed',
              startedAt: Date.now(),
            }
          : call
      )
    );
  }, []);

  const finishCallRecord = useCallback((id, status) => {
    if (!id) return;

    const allowedStatuses = [
      'completed',
      'missed',
      'rejected',
      'failed',
    ];

    if (!allowedStatuses.includes(status)) return;

    setRecentCalls((previous) =>
      previous.map((call) => {
        if (call.id !== id) return call;

        // A final status must not be overwritten by another event.
        if (
          ['missed', 'rejected', 'failed'].includes(call.status)
        ) {
          return call;
        }

        const duration = call.startedAt
          ? Math.max(0, Date.now() - call.startedAt)
          : 0;

        return {
          ...call,
          status,
          duration,
          startedAt: null,
        };
      })
    );
  }, []);

  const updateCallName = useCallback((id, name) => {
    const cleanName = String(name || '').trim();
    if (!id || !cleanName) return;

    updateCallRecord(id, { name: cleanName });
  }, [updateCallRecord]);

  const deleteCallRecord = useCallback((id) => {
    if (!id) return;

    setRecentCalls((previous) =>
      previous.filter((call) => call.id !== id)
    );
  }, []);

  return {
    recentCalls,
    startCallRecord,
    updateCallRecord,
    markCallConnected,
    finishCallRecord,
    updateCallName,
    deleteCallRecord,
  };
}
