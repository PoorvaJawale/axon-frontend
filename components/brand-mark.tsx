import Image from "next/image";

/** The approved standalone emblem. Keep the product name as separate UI text. */
export function BrandMark({ size = 34, decorative = true }: { size?: number; decorative?: boolean }) {
  return (
    <Image
      src="/brand/axon-emblem.webp"
      alt={decorative ? "" : "Axon"}
      width={size}
      height={size}
      sizes={size + "px"}
      loading="eager"
      style={{ display: "block", flexShrink: 0, objectFit: "contain" }}
    />
  );
}
