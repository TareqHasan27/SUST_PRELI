import app from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, "0.0.0.0", () => {
  console.log(`QueueStorm Investigator API listening on port ${env.port}`);
});
