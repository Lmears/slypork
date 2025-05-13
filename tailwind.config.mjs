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
      colors: {
        primary: '#073b4c',
        heading: '#193a4a',
        body: '#333333',
        light: '#f3f5f6',
        section: '#e7ebed',
      },
      screens: {
        'nav-hide': '642px', // Even though this is close to sm: there may be more nav items in the future
      },
    }
  },
  plugins: [],
}