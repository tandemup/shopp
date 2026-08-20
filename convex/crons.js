import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "eliminar adjuntos de denuncias abandonadas",
  { hours: 1 },
  internal.rightsReports.cleanupExpiredDrafts,
);

crons.interval(
  "eliminar imagenes temporales de productos",
  { hours: 6 },
  internal.temporaryProductImages.cleanupExpired,
);

crons.interval(
  "eliminar mensajes de chat caducados",
  { hours: 1 },
  internal.chat.deleteExpiredMessages,
);

export default crons;
