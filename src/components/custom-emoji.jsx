export default function CustomEmoji({ staticUrl, alt, url }) {
  return (
    <picture>
      <source srcset={staticUrl} media="(prefers-reduced-motion: reduce)" />
      <img
        key={alt}
        src={url}
        alt={alt}
        class="shortcode-emoji emoji"
        width="16"
        height="16"
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
