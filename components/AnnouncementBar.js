export default function AnnouncementBar() {
  const msg = process.env.NEXT_PUBLIC_ANNOUNCEMENT?.trim();
  if (!msg) return null;
  return (
    <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 text-center px-3">
      {msg}
    </div>
  );
}
