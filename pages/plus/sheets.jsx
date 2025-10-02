import { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";

export default function PlusSheets() {
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    fetch("/api/plus/sheets")
      .then(r => r.json())
      .then(setSheets)
      .catch(() => setSheets([]));
  }, []);

  return (
    <div>
      <NavBar />
      <main className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">📑 Fiches synthèse (EDB Plus)</h1>
        {sheets.length === 0 && (
          <div className="opacity-70">Aucune fiche disponible pour l’instant.</div>
        )}
        <ul className="space-y-3">
          {sheets.map(s => (
            <li key={s.id} className="p-3 bg-base-100 shadow rounded-xl flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs opacity-60">{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                Télécharger
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}