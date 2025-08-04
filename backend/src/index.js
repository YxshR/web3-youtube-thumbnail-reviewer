  import express from "express";
  import userRouter from "./routers/user.js";
  import workerRouter from "./routers/worker.js";
  import cors from "cors";

  const app = express();

  app.use(express.json());
  app.use(cors())


  app.use("/v1/user", userRouter);
  app.use("/v1/worker", workerRouter);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });