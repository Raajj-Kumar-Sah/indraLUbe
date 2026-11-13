export const shipmentTransitions = Object.freeze({
  CREATED: ["PICKED_UP", "IN_TRANSIT"],
  PICKED_UP: ["IN_TRANSIT", "DELIVERY_FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED", "RETURN_INITIATED"],
  OUT_FOR_DELIVERY: ["DELIVERY_FAILED"],
  DELIVERY_FAILED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "RETURN_INITIATED"],
  DELIVERED: [],
  RETURN_INITIATED: ["RETURNED"],
  RETURNED: []
});

export function canTransitionShipment(from, to) {
  return Array.isArray(shipmentTransitions[from]) && shipmentTransitions[from].includes(to);
}

export const orderTransitions = Object.freeze({
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["CANCELLED"],
  DISPATCHED: [],
  OUT_FOR_DELIVERY: [],
  DELIVERED: [],
  CANCELLED: []
});

export function canTransitionOrder(from, to) {
  return Array.isArray(orderTransitions[from]) && orderTransitions[from].includes(to);
}
