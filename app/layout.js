import './style.css';
export const metadata = { title: 'Cabinet' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: false };
export default function L({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
