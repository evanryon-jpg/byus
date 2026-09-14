export default function ByUsLogo({ className = 'h-10 w-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 146 40"
      role="img"
      aria-label="ByUs"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#172554" />
        <circle cx="11" cy="9" r="4.5" fill="#2563EB" />
        <path fill="#2563EB" d="M10 15c-4.8 0-7.5 3.8-7.5 9v2.5C2.5 33 7.7 38 14 38h6v-7c-4.5 0-7-2.7-7-7.5V15h-3Z" />
        <circle cx="29" cy="9" r="4.5" fill="#0F766E" />
        <path fill="#0F766E" d="M30 15c4.8 0 7.5 3.8 7.5 9v2.5C37.5 33 32.3 38 26 38h-6v-7c4.5 0 7-2.7 7-7.5V15h3Z" />
        <rect x="12" y="16" width="16" height="9" rx="3.5" fill="#fff" stroke="#172554" strokeWidth="1.2" />
        <path d="M23.5 24.5l3 3-.5-3.5" fill="#fff" stroke="#172554" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="16.5" cy="20.5" r="1" fill="#2563EB" />
        <circle cx="20" cy="20.5" r="1" fill="#172554" />
        <circle cx="23.5" cy="20.5" r="1" fill="#0F766E" />
      </g>
      <text
        x="47"
        y="28"
        fill="#172554"
        fontFamily="Karla, ui-sans-serif, system-ui, sans-serif"
        fontSize="27"
        fontWeight="700"
        letterSpacing="-0.9"
      >
        ByUs
      </text>
    </svg>
  );
}
