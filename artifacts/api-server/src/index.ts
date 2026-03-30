import app from "./app";

const port = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + port);
});
