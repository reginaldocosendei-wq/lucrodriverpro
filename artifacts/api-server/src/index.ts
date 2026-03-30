import app from "./app";
import { pool } from "@workspace/db";

const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + port);

  // Non-blocking DB sanity check — confirms the connection and users table are reachable
  pool
    .query("SELECT COUNT(*) AS cnt FROM users")
    .then((r) => console.log(`[startup] DB ok — users in table: ${r.rows[0].cnt}`))
    .catch((err: Error) => console.error("[startup] DB check failed:", err.message));
});
