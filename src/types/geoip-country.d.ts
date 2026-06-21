declare module 'geoip-country' {
  /**
   * Country lookup result returned by geoip-country v5.
   * Fields beyond `country` are returned by the package but unused
   * in this project — typed loosely to avoid drift if upstream changes.
   */
  export interface CountryLookup {
    country: string;
    name?: string;
    native?: string;
    phone?: number[];
    continent?: string;
    capital?: string;
    currency?: string[];
    languages?: string[];
    continent_name?: string;
  }
  const geoip: {
    lookup(ip: string): CountryLookup | null;
  };
  export default geoip;
}
