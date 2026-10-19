# Axon emblem

The approved identity is the standalone emerald sentinel emblem, with no lettering baked into the artwork. The Axon product name remains separate interface text where needed for recognition and accessible navigation.

- Source artwork: public/brand/axon-sentinel-emblem-concept.png (original dark presentation).
- Transparent master: public/brand/axon-emblem-master.png.
- Website asset: public/brand/axon-emblem.webp (256 px; optimized for small placements).
- PNG compatibility asset: public/brand/axon-emblem.png.
- Legacy public URL: public/axon-logo.png (updated to the new emblem).
- Browser icon: app/favicon.ico (16, 32, 48, and 64 px).
- Additional browser/home-screen icon: app/icon.png (192 px).
- Apple touch icon: app/apple-icon.png (180 px, dark background).

Use components/brand-mark.tsx for all in-app brand symbols. It is used in the shared header, footer, dashboard sidebar, and mobile dashboard header. Shared header/footer placements cover the landing, docs, public pages, and sign-in/sign-up shells.

Next.js adds icon metadata from its file conventions. A browser may cache an old favicon; reloading or reopening the tab may be needed after deployment. No text is included in the emblem itself.

The earlier generated logo concepts remain reference assets; they are not used by the application. Logos configured separately in external services, such as the Clerk hosted account portal or Razorpay dashboard, must be uploaded in those services; they are not controlled by this repository.
