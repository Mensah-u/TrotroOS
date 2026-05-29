/**
 * Lightweight, dependency-free marker clustering for react-native-maps.
 *
 *   1. Drop markers outside the current viewport (with padding) so we never
 *      render off-screen Markers.
 *   2. Bucket the remaining markers into a grid where each cell is roughly
 *      `gridSizePx` pixels wide at the current zoom level.
 *   3. Cells with ≥ `minPoints` markers collapse into a cluster bubble at
 *      the cluster centroid.
 *   4. Lone markers pass through untouched.
 *
 * The "pixel grid" is implemented as a lat/lng grid sized to the current
 * region — no actual pixel math required, since latitudeDelta /
 * longitudeDelta already encode the visible window for the same screen.
 */

/**
 * @typedef {Object} MarkerInput
 * @property {string|number} id
 * @property {number} latitude
 * @property {number} longitude
 * @property {any} [data]   - arbitrary payload returned untouched
 */

/**
 * @typedef {Object} ClusterResult
 * @property {string} id              - "cluster:<cell>" or original marker id
 * @property {boolean} isCluster
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} count           - 1 for individual, ≥2 for clusters
 * @property {MarkerInput|null} marker - original marker (when !isCluster)
 * @property {MarkerInput[]} markers   - all source markers (always populated)
 */

/**
 * Expand a region's lat/lng box by a percentage so markers that just slid
 * past the edge stay rendered for a frame or two (no flicker).
 */
function paddedBbox(region, paddingPct = 0.15) {
  const padLat = region.latitudeDelta * paddingPct;
  const padLng = region.longitudeDelta * paddingPct;
  return {
    minLat: region.latitude - region.latitudeDelta / 2 - padLat,
    maxLat: region.latitude + region.latitudeDelta / 2 + padLat,
    minLng: region.longitude - region.longitudeDelta / 2 - padLng,
    maxLng: region.longitude + region.longitudeDelta / 2 + padLng,
  };
}

/**
 * @param {MarkerInput[]} markers
 * @param {Object} opts
 * @param {{ latitude:number, longitude:number, latitudeDelta:number, longitudeDelta:number }} opts.region
 * @param {number} [opts.mapWidth]       Pixel width of the map (default 360)
 * @param {number} [opts.mapHeight]      Pixel height of the map (default 320)
 * @param {number} [opts.gridSizePx]     Cell size in px (default 64)
 * @param {number} [opts.minPoints]      Min markers per cell to collapse (default 2)
 * @param {boolean} [opts.includeAlwaysIds] Marker ids that should never collapse
 *   into a cluster (e.g. the reserved-ride / "you" marker).
 * @returns {ClusterResult[]}
 */
export function clusterMarkers(markers, opts = {}) {
  const {
    region,
    mapWidth = 360,
    mapHeight = 320,
    gridSizePx = 64,
    minPoints = 2,
    includeAlwaysIds = null,
  } = opts;

  if (!region || !Array.isArray(markers) || markers.length === 0) return [];

  const bbox = paddedBbox(region);
  const alwaysSet = includeAlwaysIds ? new Set(includeAlwaysIds) : null;

  // Cell size in degrees — derived from how many cells fit on screen.
  const cellsAcross = Math.max(2, Math.round(mapWidth / gridSizePx));
  const cellsDown   = Math.max(2, Math.round(mapHeight / gridSizePx));
  const cellLat = region.latitudeDelta / cellsDown;
  const cellLng = region.longitudeDelta / cellsAcross;

  /** @type {Map<string, MarkerInput[]>} */
  const buckets = new Map();
  /** @type {ClusterResult[]} */
  const passthrough = [];

  for (const m of markers) {
    if (m == null || m.latitude == null || m.longitude == null) continue;

    const inside =
      m.latitude  >= bbox.minLat &&
      m.latitude  <= bbox.maxLat &&
      m.longitude >= bbox.minLng &&
      m.longitude <= bbox.maxLng;
    if (!inside) continue;

    if (alwaysSet?.has(m.id)) {
      passthrough.push({
        id: String(m.id),
        isCluster: false,
        latitude: m.latitude,
        longitude: m.longitude,
        count: 1,
        marker: m,
        markers: [m],
      });
      continue;
    }

    const cx = Math.floor((m.longitude - bbox.minLng) / cellLng);
    const cy = Math.floor((m.latitude  - bbox.minLat) / cellLat);
    const key = `${cx}:${cy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  const results = [...passthrough];

  for (const [key, group] of buckets) {
    if (group.length >= minPoints) {
      let sumLat = 0;
      let sumLng = 0;
      for (const g of group) { sumLat += g.latitude; sumLng += g.longitude; }
      results.push({
        id: `cluster:${key}`,
        isCluster: true,
        latitude: sumLat / group.length,
        longitude: sumLng / group.length,
        count: group.length,
        marker: null,
        markers: group,
      });
    } else {
      for (const m of group) {
        results.push({
          id: String(m.id),
          isCluster: false,
          latitude: m.latitude,
          longitude: m.longitude,
          count: 1,
          marker: m,
          markers: [m],
        });
      }
    }
  }

  return results;
}

/**
 * Compute the region a zoom-in should target when a cluster is tapped.
 * Returns the bounding box of the markers in the cluster, padded slightly.
 */
export function regionForCluster(cluster, paddingPct = 0.4) {
  if (!cluster?.markers?.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const m of cluster.markers) {
    if (m.latitude  < minLat) minLat = m.latitude;
    if (m.latitude  > maxLat) maxLat = m.latitude;
    if (m.longitude < minLng) minLng = m.longitude;
    if (m.longitude > maxLng) maxLng = m.longitude;
  }
  const latitudeDelta  = Math.max(0.004, (maxLat - minLat) * (1 + paddingPct));
  const longitudeDelta = Math.max(0.004, (maxLng - minLng) * (1 + paddingPct));
  return {
    latitude:  (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
