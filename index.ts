import express from "express";
import cors from "cors";
import authRouter from "./auth/index";
import { getDatabase } from "./lib/mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
console.log("MONGODB_URI:", process.env.MONGODB_URI);

app.get("/health", (req, res) => res.send({ status: "OK" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
