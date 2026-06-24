import { useEffect } from 'react';
import { Platform } from 'react-native';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'video.movie' | 'video.tv_show';
  rating?: number;
  year?: string;
  genres?: string;
  url?: string;
}

const APP_NAME = 'VioletFlixTV';
const DEFAULT_DESC = 'Stream Movies, TV Series, Anime & Live Sports in HD on VioletFlixTV';
const DEFAULT_IMAGE = 'https://ui-avatars.com/api/?name=VioletFlixTV&background=7c3aed&color=fff&size=600&bold=true&format=png';
const BASE_URL = 'https://violetflixtv.vercel.app';

function setMeta(property: string, content: string, isName = false) {
  if (Platform.OS !== 'web') return;
  const attr = isName ? 'name' : 'property';
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, property); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setTitle(t: string) {
  if (Platform.OS !== 'web') return;
  document.title = t;
}

function setJsonLd(data: object) {
  if (Platform.OS !== 'web') return;
  let el = document.getElementById('vftv-jsonld');
  if (!el) {
    el = document.createElement('script');
    el.id = 'vftv-jsonld';
    el.setAttribute('type', 'application/ld+json');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function setCanonical(url: string) {
  if (Platform.OS !== 'web') return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) { el = document.createElement('link') as HTMLLinkElement; el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = url;
}

export function useSEO({ title, description, image, type = 'website', rating, year, genres, url }: SEOProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const fullTitle = title ? `${title} — ${APP_NAME}` : APP_NAME;
    const desc = description || DEFAULT_DESC;
    const img = image || DEFAULT_IMAGE;
    const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : BASE_URL);

    setTitle(fullTitle);
    setCanonical(pageUrl);

    // Open Graph
    setMeta('og:title', fullTitle);
    setMeta('og:description', desc);
    setMeta('og:image', img);
    setMeta('og:url', pageUrl);
    setMeta('og:type', type);
    setMeta('og:site_name', APP_NAME);

    // Twitter / X cards
    setMeta('twitter:card', 'summary_large_image', true);
    setMeta('twitter:title', fullTitle, true);
    setMeta('twitter:description', desc, true);
    setMeta('twitter:image', img, true);
    setMeta('twitter:site', '@VioletFlixTV', true);

    // Standard meta
    setMeta('description', desc, true);
    setMeta('theme-color', '#7c3aed', true);

    // JSON-LD schema.org
    if (type === 'video.movie' && title) {
      setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Movie',
        name: title,
        description: desc,
        image: img,
        datePublished: year,
        genre: genres,
        aggregateRating: rating ? { '@type': 'AggregateRating', ratingValue: rating.toFixed(1), bestRating: '10', ratingCount: '1000' } : undefined,
        url: pageUrl,
        publisher: { '@type': 'Organization', name: APP_NAME, url: BASE_URL },
      });
    } else if (type === 'video.tv_show' && title) {
      setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'TVSeries',
        name: title,
        description: desc,
        image: img,
        genre: genres,
        url: pageUrl,
        publisher: { '@type': 'Organization', name: APP_NAME, url: BASE_URL },
      });
    } else {
      setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: APP_NAME,
        url: BASE_URL,
        description: DEFAULT_DESC,
        publisher: { '@type': 'Organization', name: 'VIOLET KING DEV' },
      });
    }
  }, [title, description, image, type, rating, year, genres, url]);
}
