export default function ByUsLogo({ className = 'h-9 w-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 126 36"
      role="img"
      aria-label="ByUs"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g aria-hidden="true">
        <circle cx="9" cy="7" r="5" fill="#2563EB" />
        <circle cx="27" cy="7" r="5" fill="#0F766E" />
        <path
          d="M3 14c0 10.5 5.1 17 15 17V21c-4.1 0-6-2.2-6-7H3Z"
          fill="#2563EB"
        />
        <path
          d="M33 14c0 10.5-5.1 17-15 17V21c4.1 0 6-2.2 6-7h9Z"
          fill="#0F766E"
        />
      </g>
      <text
        x="43"
        y="26"
        fill="#172554"
        fontFamily="Karla, ui-sans-serif, system-ui, sans-serif"
        fontSize="25"
        fontWeight="700"
        letterSpacing="-0.8"
      >
        ByUs
      </text>
    </svg>
  );
}
