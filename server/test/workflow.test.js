import test from "node:test";
import assert from "node:assert/strict";
import {canTransitionShipment,canTransitionOrder} from "../src/modules/shipments/workflow.js";

test("shipment progresses through dispatch and delivery states",()=>{
 assert.equal(canTransitionShipment("CREATED","PICKED_UP"),true);
 assert.equal(canTransitionShipment("PICKED_UP","IN_TRANSIT"),true);
 assert.equal(canTransitionShipment("IN_TRANSIT","OUT_FOR_DELIVERY"),true);
 assert.equal(canTransitionShipment("OUT_FOR_DELIVERY","DELIVERED"),false,"delivery must be OTP-confirmed, not an admin status edit");
});
test("failed deliveries can be retried or returned",()=>{
 assert.equal(canTransitionShipment("DELIVERY_FAILED","IN_TRANSIT"),true);
 assert.equal(canTransitionShipment("DELIVERY_FAILED","RETURN_INITIATED"),true);
 assert.equal(canTransitionShipment("RETURN_INITIATED","RETURNED"),true);
 assert.equal(canTransitionShipment("RETURNED","IN_TRANSIT"),false);
});
test("order fulfilment cannot bypass shipment workflow",()=>{
 assert.equal(canTransitionOrder("PLACED","CONFIRMED"),true);
 assert.equal(canTransitionOrder("PROCESSING","PACKED"),true);
 assert.equal(canTransitionOrder("PACKED","DISPATCHED"),false);
 assert.equal(canTransitionOrder("OUT_FOR_DELIVERY","DELIVERED"),false);
});
test("invalid states are rejected",()=>{
 assert.equal(canTransitionShipment("UNKNOWN","DELIVERED"),false);
 assert.equal(canTransitionOrder("UNKNOWN","CANCELLED"),false);
});
