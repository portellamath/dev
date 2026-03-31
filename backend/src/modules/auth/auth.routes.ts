import { Router } from "express";
import {
  forgotPasswordController,
  resetPasswordController,
} from "./auth.controller";

const authRoutes = Router();

authRoutes.post("/forgot-password", forgotPasswordController);
authRoutes.post("/reset-password", resetPasswordController);

export default authRoutes;