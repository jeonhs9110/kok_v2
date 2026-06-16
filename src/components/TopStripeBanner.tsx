import Link from 'next/link';

export interface TopStripeBannerData {
  is_active: boolean;
  text: string;
  link_url: string;
  bg_color: string;
  text_color: string;
}

interface Props {
  data: TopStripeBannerData | null;
}

/**
 * TopStripeBanner — a thin promotional band rendered above the header
 * on every page. Hidden when inactive or empty. Operator's 2026-06-17
 * ask after pointing at Cafe24's equivalent ("첫 쇼핑을 지원하는…"
 * coupon stripe).
 *
 * If link_url is set, the whole stripe becomes a clickable Link;
 * otherwise it renders as a div.
 */
export default function TopStripeBanner({ data }: Props) {
  if (!data || !data.is_active || !data.text) return null;
  const style: React.CSSProperties = {
    backgroundColor: data.bg_color || '#1f2937',
    color: data.text_color || '#ffffff',
  };
  const inner = (
    <div
      className="text-center py-2 px-4 text-[12px] sm:text-[13px] font-medium tracking-wide"
      style={style}
    >
      {data.text}
    </div>
  );
  if (data.link_url) {
    return <Link href={data.link_url} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  }
  return inner;
}
