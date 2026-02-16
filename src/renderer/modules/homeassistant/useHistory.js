import { useState, useCallback, useRef } from 'react';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT = 5;
const MAX_POINTS = 50;
const MAX_POINTS_DETAIL = 200;

/**
 * Hook pour récupérer l'historique des capteurs HA (sparklines 24h).
 */
export default function useHistory(haUrl, haToken) {
  // cache: Map<entityId, {data: number[], fetchedAt: number}>
  const cacheRef = useRef(new Map());
  const pendingRef = useRef(new Set());
  const [version, setVersion] = useState(0); // force re-render

  // Downsampler : réduire à maxPts
  const downsample = (arr, maxPts = MAX_POINTS) => {
    if (arr.length <= maxPts) return arr;
    const step = arr.length / maxPts;
    const result = [];
    for (let i = 0; i < maxPts; i++) {
      result.push(arr[Math.floor(i * step)]);
    }
    return result;
  };

  // Fetch l'historique d'une entité
  const fetchOne = useCallback(async (entityId) => {
    if (!haUrl || !haToken || !window.electronAPI?.fetchHomeAssistant) return null;
    if (pendingRef.current.has(entityId)) return null;

    // Vérifier le cache
    const cached = cacheRef.current.get(entityId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

    pendingRef.current.add(entityId);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endpoint = `history/period/${start.toISOString()}?filter_entity_id=${entityId}&minimal_response&no_attributes`;

      const result = await window.electronAPI.fetchHomeAssistant(haUrl, haToken, endpoint);

      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        // L'API retourne un tableau de tableaux (un par entité)
        const states = result.data[0];
        if (!Array.isArray(states)) return null;

        // Extraire les valeurs numériques
        const points = [];
        for (const s of states) {
          const v = parseFloat(s.state);
          if (!isNaN(v)) points.push(v);
        }

        if (points.length < 2) return null;

        const data = downsample(points);
        cacheRef.current.set(entityId, { data, fetchedAt: Date.now() });
        setVersion(v => v + 1);
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendingRef.current.delete(entityId);
    }
  }, [haUrl, haToken]);

  // Fetch batch (max concurrent)
  const fetchBatch = useCallback(async (entityIds) => {
    const toFetch = entityIds.filter(id => {
      const cached = cacheRef.current.get(id);
      return !cached || Date.now() - cached.fetchedAt >= CACHE_TTL;
    });
    if (toFetch.length === 0) return;

    // Fetch par batch de MAX_CONCURRENT
    for (let i = 0; i < toFetch.length; i += MAX_CONCURRENT) {
      const batch = toFetch.slice(i, i + MAX_CONCURRENT);
      await Promise.all(batch.map(fetchOne));
    }
  }, [fetchOne]);

  // Récupérer depuis le cache
  const getHistory = useCallback((entityId) => {
    const cached = cacheRef.current.get(entityId);
    return cached?.data || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Fetch détaillé pour le modal (200 points + timestamps)
  const fetchDetailed = useCallback(async (entityId) => {
    if (!haUrl || !haToken || !window.electronAPI?.fetchHomeAssistant) return null;
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const endpoint = `history/period/${start.toISOString()}?filter_entity_id=${entityId}&minimal_response`;

      const result = await window.electronAPI.fetchHomeAssistant(haUrl, haToken, endpoint);
      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return null;

      const states = result.data[0];
      if (!Array.isArray(states)) return null;

      // Extraire valeurs numériques + timestamps
      const raw = [];
      for (const s of states) {
        const v = parseFloat(s.state);
        if (!isNaN(v)) raw.push({ value: v, timestamp: s.last_changed || s.last_updated });
      }
      if (raw.length < 2) return null;

      const sampled = downsample(raw, MAX_POINTS_DETAIL);
      return {
        points: sampled.map(r => r.value),
        timestamps: sampled.map(r => r.timestamp),
      };
    } catch {
      return null;
    }
  }, [haUrl, haToken]);

  return { getHistory, fetchBatch, fetchOne, fetchDetailed };
}
