import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_KEY = 'ha_area_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Hook pour récupérer les areas/pièces de Home Assistant
 * et mapper chaque entité à sa pièce via le device registry.
 */
export default function useAreas(haUrl, haToken, isConnected) {
  // areas: Map<areaId, {id, name}>
  const [areas, setAreas] = useState(new Map());
  // areaEntityMap: Map<entityId, areaId>
  const [areaEntityMap, setAreaEntityMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchAreas = useCallback(async () => {
    if (!haUrl || !haToken || !window.electronAPI?.fetchHomeAssistant) return;

    // Vérifier le cache (ignorer si vide = ancien cache invalide)
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { areas: cachedAreas, entityMap, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL && cachedAreas && cachedAreas.length > 0) {
          setAreas(new Map(cachedAreas));
          setAreaEntityMap(new Map(entityMap));
          return;
        }
      }
    } catch { /* cache invalide */ }

    setIsLoading(true);
    try {
      // Utiliser l'API template HA (compatible toutes versions)
      // Une seule requête retourne toutes les pièces avec leurs entités
      const template = `[{% for aid in areas() %}{"id":"{{ aid }}","name":"{{ area_name(aid) }}","entities":{{ area_entities(aid) | to_json }}}{% if not loop.last %},{% endif %}{% endfor %}]`;

      const result = await window.electronAPI.fetchHomeAssistant(
        haUrl, haToken, 'template',
        { method: 'POST', body: { template } }
      );

      if (!result.success) {
        console.warn('useAreas: template fetch failed:', result.error);
        setAreas(new Map());
        setAreaEntityMap(new Map());
        return;
      }

      // Le résultat est une string JSON
      let areaData;
      try {
        areaData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      } catch {
        console.warn('useAreas: failed to parse template result');
        setAreas(new Map());
        setAreaEntityMap(new Map());
        return;
      }

      if (!Array.isArray(areaData)) {
        setAreas(new Map());
        setAreaEntityMap(new Map());
        return;
      }

      console.log(`useAreas: ${areaData.length} pièces trouvées`);

      // Construire les maps
      const areasMap = new Map();
      const entityMap = new Map();

      for (const area of areaData) {
        areasMap.set(area.id, { id: area.id, name: area.name });
        if (Array.isArray(area.entities)) {
          for (const entityId of area.entities) {
            entityMap.set(entityId, area.id);
          }
        }
      }

      console.log(`useAreas: ${entityMap.size} entités mappées à des pièces`);

      setAreas(areasMap);
      setAreaEntityMap(entityMap);

      // Sauvegarder en cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          areas: [...areasMap.entries()],
          entityMap: [...entityMap.entries()],
          timestamp: Date.now(),
        }));
      } catch { /* quota */ }

    } catch (err) {
      console.warn('useAreas: fetch failed, fallback flat view:', err.message);
      setAreas(new Map());
      setAreaEntityMap(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [haUrl, haToken]);

  // Fetch au montage quand connecté
  useEffect(() => {
    if (isConnected && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAreas();
    }
    if (!isConnected) {
      fetchedRef.current = false;
    }
  }, [isConnected, fetchAreas]);

  // Rafraîchir manuellement
  const refresh = useCallback(() => {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    fetchedRef.current = false;
    fetchAreas();
  }, [fetchAreas]);

  return { areas, areaEntityMap, isLoading, refresh };
}
