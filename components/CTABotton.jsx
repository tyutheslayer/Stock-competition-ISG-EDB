export default function CTAButton({ children, className = "", ...props }) {
  return (
    <button
      className={`btn border-0 text-base-100
                  bg-gradient-to-r from-brand.accent1 to-brand.primary
                  hover:opacity-90 neon-outline ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}