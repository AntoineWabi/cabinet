export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    heart: (
      <path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" />
    ),
    coverflow: (
      <>
        <rect x="9" y="4" width="6" height="16" rx="1" />
        <path d="M5 7H2v10h3M19 7h3v10h-3" />
      </>
    ),
    shelf: (
      <>
        <rect x="3" y="4" width="4" height="16" rx="1" />
        <rect x="10" y="4" width="4" height="16" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      </>
    ),
    stack: (
      <>
        <rect x="4" y="3" width="16" height="4" rx="1" />
        <rect x="4" y="10" width="16" height="4" rx="1" />
        <rect x="4" y="17" width="16" height="4" rx="1" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    left: <path d="m14 5-7 7 7 7" />,
    right: <path d="m10 5 7 7-7 7" />,
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    album: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6.5 12A5.5 5.5 0 0 1 12 6.5" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h13v16H6.5A2.5 2.5 0 0 1 4 17.5V6a2 2 0 0 1 2-2M4 17h14M8 4v13" />
      </>
    ),
    movie: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 3v18M16 3v18M4 8h4M4 16h4M16 8h4M16 16h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M13 17a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"
          transform="translate(0 -1) scale(.95)"
        />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.album}
    </svg>
  );
}
