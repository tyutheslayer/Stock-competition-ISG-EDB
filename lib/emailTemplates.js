// lib/emailTemplates.js

export function miniCourseWelcomeEmail({ toEmail }) {
  const title = "Bienvenue à l’École de la Bourse 🎓";
  const preview = "Tu es inscrit aux mini-cours du jeudi (13h-13h30).";
  const calendarUrl = "https://stock-competition-kyqvhfzh8-tyutheslayers-projects.vercel.app/calendar";

  // Styles très sobres + compatibles clients mail
  return {
    subject: "Bienvenue aux mini-cours du jeudi 🎓",
    text: [
      "Bienvenue à l’École de la Bourse !",
      "",
      "✅ Tu es inscrit aux mini-cours gratuits du jeudi (13h–13h30, heure de Paris).",
      "💬 Juste après : session trading pour les membres « Plus ».",
      "",
      `🗓 Le calendrier des sessions : ${calendarUrl}`,
      "",
      "À très vite,",
      "— L’équipe EDB",
    ].join("\n"),
    html: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light only" />
    <meta name="viewport" content="width=device-width" />
    <title>${title}</title>
    <style>
      .container{max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',Arial,'Noto Sans',sans-serif;color:#111}
      .card{border:1px solid #eee;border-radius:14px;padding:24px}
      .btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600}
      .muted{color:#6b7280;font-size:14px}
      .pill{display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px;font-size:12px;color:#374151}
    </style>
  </head>
  <body style="background:#f8fafc;padding:24px">
    <div class="container">
      <div style="margin-bottom:16px;color:#6b7280;font-size:0">${preview}</div>
      <div class="card" style="background:#fff">
        <h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2">
          Bienvenue à l’<span style="color:#2563eb">École de la Bourse</span> 🎓
        </h1>
        <p style="margin:12px 0;font-size:16px;line-height:1.6">
          ✅ Tu es inscrit aux <b>mini-cours gratuits du jeudi</b> (13h–13h30, heure de Paris).<br/>
          💬 Juste après : <b>session trading</b> pour les membres <b>Plus</b>.
        </p>

        <p style="margin:12px 0;font-size:16px;line-height:1.6">
          Consulte le calendrier complet des sessions et ajoute celles qui t’intéressent :
        </p>

        <p style="margin:18px 0">
          <a class="btn" href="${calendarUrl}" target="_blank" rel="noopener">Voir le calendrier</a>
        </p>

        <p class="muted" style="margin-top:24px">
          Si tu n’es pas à l’aise avec les horaires : tout est affiché en <b>Europe/Paris</b>.
        </p>

        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />

        <p class="muted">
          Reçu par : ${toEmail}<br/>
          Tu peux gérer tes préférences depuis ton compte à tout moment.
        </p>
      </div>

      <p class="muted" style="text-align:center;margin-top:16px">
        © ${new Date().getFullYear()} École de la Bourse — Tous droits réservés.
      </p>
    </div>
  </body>
</html>`
  };
}