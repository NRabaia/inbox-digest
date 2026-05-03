import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailsRouter from "./emails";
import uploadEmlRouter from "./uploadEml";
import uploadPstRouter from "./uploadPst";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailsRouter);
router.use(uploadEmlRouter);
router.use(uploadPstRouter);
router.use(configRouter);

export default router;
