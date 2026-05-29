let pendingRidePrefill = null;

export function setPendingRidePrefill(payload) {
  pendingRidePrefill = payload;
}

export function consumePendingRidePrefill() {
  const p = pendingRidePrefill;
  pendingRidePrefill = null;
  return p;
}
