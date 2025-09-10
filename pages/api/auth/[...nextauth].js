import NextAuthHandler from "../../../lib/auth";
export { authOptions } from "../../../lib/auth";

export default function handler(req, res) {
  return NextAuthHandler(req, res);
}
