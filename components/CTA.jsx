// components/CTA.jsx
import Link from "next/link";

export default function CTA() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-base-200 to-base-100 border shadow p-8 md:p-10">
        <div className="grid md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <h3 className="text-2xl md:text-3xl font-extrabold">
              Prêt(e) à te lancer ? 💥
            </h3>
            <p className="mt-2 opacity-80">
              Rejoins la prochaine session gratuite du jeudi (13h–13h30) et commence à trader sur le simulateur.
            </p>
          </div>
          <div className="flex md:justify-end gap-3">
            <Link href="/login" className="btn btn-primary">
              Je m’inscris
            </Link>
            <Link href="/calendar" className="btn btn-outline">
              Voir le calendrier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}