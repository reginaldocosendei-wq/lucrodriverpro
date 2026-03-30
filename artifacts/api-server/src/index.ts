import app from "./app";

const port = Number(process.env.PORT) || 3000;

// health check (required for autoscale)
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

// start server IMMEDIATELY (no async before this)
app.listen(port, "0.0.0.0", () => {
  console.log(`SERVER RUNNING ON PORT ${port}`);
});

// error logging to catch silent crashes
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});
