const uiKitPreset = require('@schema/ui-kit/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [uiKitPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
