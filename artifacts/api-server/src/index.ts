import express from "express";

const app = express();

app.use(express.json());

// health check (required for autoscale)
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

// simple test route
app.get("/api/test", (_req, res) => {
  res.json({ status: "API working" });
});

const port = Number(process.env.PORT) || 3000;

// FORCE server to start immediately
app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT:", port);
});

// catch silent crashes
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
});
