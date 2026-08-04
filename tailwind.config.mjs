// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',         // Scans HTML files in the root
    './!(node_modules)/**/*.html',    // Scans HTML files in immediate subdirectories (like cv/index.html)
    './assets/js/**/*.js'             // Scans ALL JS files including subdirectories
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Roboto', 'sans-serif'
        ],
        // KerBy's own title face - see the @font-face in input.css.
        kerby: [
          '"Kiwi Soda"', 'Roboto', 'sans-serif'
        ],
      },
      colors: {
        background: '#f3f4f1',
        backgroundHovered: '#dcddd9',
        primary: '#073b4c',
        heading: '#193a4a',
        body: '#333333',
        section: '#e7ebed',
        // KerBy's own palette, lifted from the plugin's KerbyLookAndFeel so the
        // /kerby/ page and the plugin read as the same product. Light-theme
        // names match the C++ members; kerbyDark* are that theme's dark values.
        kerbyCream: '#fff0f5',
        kerbyPink: '#ff8fab',
        kerbyPinkDark: '#ff6f91',
        kerbyRed: '#ff4d6d',
        kerbyDarkPanel: '#2b2226',
        kerbyDarkAccent: '#ff7d9c',
        kerbyDarkText: '#ffc2d1',
      },
      screens: {
        'sm': '642px', // Even though this is close to default sm: there may be more nav items in the future
        'md': '768px',
        'lg': '1024px',
        'show-hamburger': { 'raw': '(max-width: 767.98px) and (min-height: 620px)' },
        'show-nav': { 'raw': '(min-height: 620px)' },
        // /kerby/'s explanation rows sit text-beside-figure only once the viewport
        // reaches #container's own max width; below that they stack. Named rather
        // than a min-[1080px] arbitrary variant, which Tailwind refuses while any
        // screen above is in object form.
        'fig-row': '1080px',
      },
    }
  },
  plugins: [],
}