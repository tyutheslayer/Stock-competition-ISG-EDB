// pages/api/plus/close.js
import handler from "../close-plus";

export default handler;

// (optionnel) On force le bodyParser au cas où
export const config = {
  api: { bodyParser: true },
};