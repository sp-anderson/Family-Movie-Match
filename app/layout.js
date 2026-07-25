import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Family Movie Match",
  description: "Swipe to find something the whole family agrees on.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
