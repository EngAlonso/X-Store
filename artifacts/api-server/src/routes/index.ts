import { Router, type IRouter } from "express";
import healthRouter from "./health";
import xstoreRouter from "./xstore";

const router: IRouter = Router();

router.use(healthRouter);
router.use(xstoreRouter);

export default router;
