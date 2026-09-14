export default function ByUsLogo({ className = 'h-9 w-auto' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 146 40"
      role="img"
      aria-label="ByUs"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g aria-hidden="true">
        <rect x="0" y="0" width="40" height="40" rx="10" fill="#172554" />
        <g transform="translate(3 3) scale(.85)">
          <path
          fill="#2563EB"
          d="M11.5 2.5a6.4 6.4 0 0 0-5.4 9.8C3.5 15 2 18.8 2 23v2.5C2 32.4 7.6 38 14.5 38H20V25.2c-4.4 0-7.3-3-7.3-7.4v-1.6c1.8-.3 3.3-1.1 4.5-2.4l-2.2-.9 2.5-1.5a6.4 6.4 0 0 0-6-8.9Z"
        />
        <path
          fill="#0F766E"
          d="M28 2.5a6.4 6.4 0 0 1 5.8 9.1 3.3 3.3 0 0 1-1 6.4c0 4.3-3 7.2-7.3 7.2H20V38h5.5C32.4 38 38 32.4 38 25.5V23c0-4.2-1.5-8-4.1-10.7l-2.2 1.5c-1.2 1.3-2.7 2.1-4.5 2.4v1.6c0 4.4-2.9 7.4-7.2 7.4V15.1c1.1 0 2.2-.5 3-1.3l2.2-.9-2.5-1.5A6.4 6.4 0 0 1 28 2.5Z"
        />
        <rect x="8.5" y="15" width="23" height="12" rx="4.5" fill="#fff" stroke="#172554" strokeWidth="1.4" />
        <path d="M24.5 26.5l4 4-.7-4.8" fill="#fff" stroke="#172554" strokeWidth="1.4" strokeLinejoin="round" />
        <text x="20" y="23" textAnchor="middle" fill="#172554" fontFamily="Arial, sans-serif" fontSize="6.2" fontWeight="700">
          ByUs
        </text>
        </g>
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
