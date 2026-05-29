import { useMemo, useRef, useState, useCallback } from 'react';

import { clusterMarkers } from '@/utils/clustering';

/**
 * Track a map's visible region and produce viewport-filtered clusters.
 *
 *   const {
 *     region,
 *     onRegionChange,
 *     onLayout,
 *     clusters,
 *   } = useViewportClusters(markers, {
 *     initialRegion,
 *     gridSizePx: 64,
 *     minPoints: 2,
 *     alwaysShow: [reservedRideId],
 *   });
 *
 * Plug the returned `onRegionChange` into the MapView's
 * `onRegionChangeComplete` and `onLayout` into `onLayout`. The hook only
 * re-buckets markers when their coords actually change *or* the region
 * changes — so it's safe to call on every render.
 */
export default function useViewportClusters(markers, options = {}) {
  const {
    initialRegion = null,
    gridSizePx = 64,
    minPoints = 2,
    alwaysShow = null,
  } = options;

  const [region, setRegion] = useState(initialRegion);
  const [layout, setLayout] = useState({ width: 360, height: 320 });

  // Throttle region updates — Android fires several events on a single pan.
  const lastUpdateRef = useRef(0);

  const onRegionChange = useCallback((next) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 120) return;
    lastUpdateRef.current = now;
    setRegion(next);
  }, []);

  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  }, []);

  const clusters = useMemo(() => {
    if (!region) return [];
    return clusterMarkers(markers, {
      region,
      mapWidth: layout.width,
      mapHeight: layout.height,
      gridSizePx,
      minPoints,
      includeAlwaysIds: alwaysShow,
    });
    // alwaysShow array reference can change every render; stringify for stability
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, region, layout.width, layout.height, gridSizePx, minPoints, JSON.stringify(alwaysShow)]);

  return { region, onRegionChange, onLayout, clusters, setRegion };
}
