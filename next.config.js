/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevents this app from being embedded in an <iframe> on another
          // site — blocks clickjacking attacks where someone overlays a
          // fake UI on top of your real app to trick clicks.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stops the browser from guessing file types differently than
          // declared — closes a class of MIME-sniffing based attacks.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limits how much of the current URL is leaked to external sites
          // when a link is clicked (e.g. an invoice/payment link opening
          // Google Drive).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disables browser features this app has no legitimate use for.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
