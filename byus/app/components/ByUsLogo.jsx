export default function ByUsLogo({ className = 'h-10 w-auto', light = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 146 40"
      role="img"
      aria-label="ByUs"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mark: a rounded "U" built from two strokes in different tones (cream + teal)
          meeting at a shared base -- two colors becoming one shape, standing in for
          "by us" -- with a small serif "B" nested in the cup, so the mark reads as
          both a U and a B at once. No dot/circle sits above the strokes on its own --
          that specific device (a rounded U with two circles floating over it) is
          UKG's actual wordmark, so it's deliberately avoided here. */}
      <g aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#172554" />
        <path
          d="M13 11 L13 21 A7 7 0 0 0 19.5 27.9"
          fill="none"
          stroke="#F8FAFC"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M27 11 L27 21 A7 7 0 0 1 20.5 27.9"
          fill="none"
          stroke="#0F766E"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <text
          x="20"
          y="24"
          textAnchor="middle"
          fontFamily="var(--font-display), Georgia, serif"
          fontSize="19"
          fontWeight="700"
          fill="#F8FAFC"
        >
          B
        </text>
      </g>
      <text
        x="47"
        y="28"
        fill={light ? '#FFFDF8' : '#172033'}
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="27"
        fontWeight="700"
        letterSpacing="-0.9"
      >
        ByUs
      </text>
    </svg>
  );
}
