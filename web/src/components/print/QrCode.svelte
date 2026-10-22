<script lang="ts">
  // A QR code drawn as one SVG path (src/flyer/qr.ts), black on white, sharp at any print size.
  import { qrMatrix, qrPath } from '../../flyer/qr.ts';

  let { text, label, size = 144 }: { text: string; label: string; size?: number } = $props();
  const drawn = $derived(qrPath(qrMatrix(text)));
</script>

<svg class="qr" viewBox={drawn.viewBox} width={size} height={size} role="img" aria-label={label} data-qr={text} shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#fff" />
  <path d={drawn.path} fill="#000" />
</svg>

<style>
  .qr {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
