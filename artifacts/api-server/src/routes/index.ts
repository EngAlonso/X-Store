import { Router, type IRouter } from "express";
import healthRouter from "./health";
import platformBackupRouter from "./platform-backup";
import xstoreRouter from "./xstore";

const router: IRouter = Router();

router.use(healthRouter);
router.use(platformBackupRouter);
router.use(xstoreRouter);

export default router;
