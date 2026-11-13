import {Router} from "express";
import {authenticate} from "../../middleware/authenticate.js";
import {authorize} from "../../middleware/authorize.js";
import * as controller from "./invoice.controller.js";
const router=Router();
router.use(authenticate,authorize("DISTRIBUTOR","ADMIN","SUPER_ADMIN"));
router.get("/order/:orderId/pdf",controller.downloadByOrder);
router.get("/:invoiceId/pdf",controller.downloadById);
export default router;
