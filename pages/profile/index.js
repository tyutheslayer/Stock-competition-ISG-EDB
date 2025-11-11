// pages/profile/index.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]";

export default function ProfileIndex() {
  // Ne s'affiche jamais : on redirige en SSR
  return null;
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // Pas connecté -> on envoie vers /login puis retour vers /profile
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent("/profile");
    return {
      redirect: { destination: `/login?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }

  // Connecté -> redirige vers /profile/{id} (la page où se trouvent tes stats + historique)
  return {
    redirect: {
      destination: `/profile/${session.user.id}`,
      permanent: false,
    },
  };
}