import NextAuthHandler, { authOptions } from "../../../lib/auth";

export default function handler(req, res) {
  return NextAuthHandler(req, res);
}
export { authOptions as authOptions };
