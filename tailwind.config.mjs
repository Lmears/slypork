// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',         // Scans HTML files in the root
    './*/**/*.html',    // Scans HTML files in immediate subdirectories (like cv/index.html)
    './assets/js/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Roboto', 'sans-serif'
        ],
      },
      colors: {
        background: '#f3f4f1',
        backgroundHovered: '#dcddd9',
        primary: '#073b4c',
        heading: '#193a4a',
        body: '#333333',
        light: '#f3f5f6',
        section: '#e7ebed',
      },
      brightness: {
        80: '.8',
        110: '1.1',
      },
      screens: {
        'sm': '642px', // Even though this is close to default sm: there may be more nav items in the future
        'md': '768px',
        'lg': '1024px',
        'show-hamburger': { 'raw': '(max-width: 767.98px) and (min-height: 620px)' },
        'show-nav': { 'raw': '(min-height: 620px)' },
      },
    }
  },
  plugins: [],
}