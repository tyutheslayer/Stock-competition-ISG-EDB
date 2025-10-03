// pages/api/sumup/oauth/start.js

export default function handler(req, res) {
  // redirige directement vers la page Plus
  res.writeHead(302, { Location: "/plus" });
  res.end();
}