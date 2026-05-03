/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        euphony: {
          bg:           '#0f0f13',
          surface:      '#1a1a24',
          card:         '#22223a',
          border:       '#2e2e4a',
          accent:       '#7c3aed',
          'accent-hover': '#6d28d9',
          'accent-light': '#a78bfa',
          text:         '#e2e8f0',
          muted:        '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
