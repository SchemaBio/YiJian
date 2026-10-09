const uiKitPreset = require('@schema/ui-kit/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [uiKitPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@schema/ui-kit/dist/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        danger: { muted: 'var(--color-danger-muted)' },
        warning: { muted: 'var(--color-warning-muted)' },
        success: { muted: 'var(--color-success-muted)' },
      },
    },
  },
  plugins: [],
};
