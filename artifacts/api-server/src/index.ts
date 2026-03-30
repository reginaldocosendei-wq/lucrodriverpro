import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("API RUNNING");
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + port);
});
