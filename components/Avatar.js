export default function Avatar({ name, email, src, size=28 }) {
  const initials = (name || email || "?")
    .replace(/[^a-zA-ZÀ-ÿ ]/g,"")
    .trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||"").join("") || "?";
  if (src) return <img src={src} alt="avatar" width={size} height={size} className="rounded-full object-cover"/>;
  return (
    <div style={{width:size,height:size}} className="rounded-full bg-primary text-white grid place-items-center text-xs">
      {initials}
    </div>
  );
}
