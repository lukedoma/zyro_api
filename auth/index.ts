import express from "express";
import register from "./register";
import registerPhone from "./register-phone";

const router = express.Router();

router.post("/register", register);
router.post("/register-phone", registerPhone);

export default router;
