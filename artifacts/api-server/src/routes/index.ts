import { Router, type IRouter } from "express";
import healthRouter from "./health";
import platformBackupRouter from "./platform-backup";
import platformDatabaseRouter from "./platform-database";
import storeBackupRouter from "./store-backup";
import xstoreRouter from "./xstore";

const router: IRouter = Router();

router.use(healthRouter);
router.use(platformBackupRouter);
router.use(platformDatabaseRouter);
router.use(storeBackupRouter);
router.use(xstoreRouter);

export default router;
