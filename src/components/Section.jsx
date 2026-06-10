export default function Section({ title, children, className = '' }) {
  return (
    <section className={`mb-12 ${className}`.trim()}>
      {title ? (
        <h2
          className="text-xl sm:text-2xl font-bold mb-5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
