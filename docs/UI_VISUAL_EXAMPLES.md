# UI Visual Examples — X-Downloader 2.0

## Layout Reference

### Hero Section
- **Left**: Headline "Download. Beautifully." + tagline + CTA buttons
- **Right**: 3D Interactive Download Orb (React Three Fiber)
- **Background**: Dark (zinc-950) with glassmorphism elements

### URL Input Section
- Style: Glass backdrop with rounded-3xl border
- Fields:
  - URL input (large, flex-1)
  - Quality dropdown (best/1080p/720p/480p/360p/audio)
  - Cookies dropdown (none/chrome/firefox/brave/edge)
- Action: Big blue "Download" button with loading state
- Subtext: Supported sites list with alert icon

### Queue Section
- Title "Active Queue" with download count
- Cards: Glassmorphism rounded-2xl, animated transitions
- Each card:
  - Status dot + icon (left)
  - Title + URL + metadata (center)
  - Progress bar (during download)
  - Error message (red, on error)
  - Cancel/Remove button (right)

### Stats Footer
- 4-column grid: Total, Completed, Active, Sites
- Glassmorphism style matching theme

## Theme Tokens

```css
--background: #09090b;     /* zinc-950 */
--foreground: #fafafa;     /* zinc-50 */
--card: #18181b;           /* zinc-900 */
--primary: #3b82f6;        /* blue-500 */
```

- Glass effect: `rgba(255,255,255,0.03)` background, `rgba(255,255,255,0.08)` border, `blur(20px)`
- Animations: Framer Motion spring curves `[0.23, 1, 0.32, 1]`
- Orb: Three.js with ambient + point lights, wireframe overlay, progress ring

## Responsive Behavior
- Desktop: Side-by-side hero (lg:flex-row)
- Tablet/Phone: Stacked layout, full-width inputs
- Stats: 4-col → 2-col on smaller screens
