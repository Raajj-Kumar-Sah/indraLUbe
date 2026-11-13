import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

const PORT = Number(process.env.PORT || 5000);

try {
  await connectDatabase();
  app.listen(PORT, () => console.log(`Indira API listening on port ${PORT}`));
} catch (error) {
  console.error("Server startup failed:", error.message);
  process.exit(1);
}
