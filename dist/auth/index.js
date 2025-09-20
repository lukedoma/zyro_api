"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const register_1 = __importDefault(require("./register"));
const register_phone_1 = __importDefault(require("./register-phone"));
const router = express_1.default.Router();
router.post("/register", register_1.default);
router.post("/register-phone", register_phone_1.default);
exports.default = router;
