import express from "express";
import cors from "cors";
import authRouter from "./auth/index";
import { getDatabase } from "./lib/mongodb";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/health", (req, res) => res.send({ status: "OK" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
