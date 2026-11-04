// Leaflet is bundled under public/vendor/leaflet (v1.9.4, BSD-2 licence) and loaded on demand,
// so the map works without an npm package and without a CDN. Only the parts the map uses are typed.

export type LatLng = [number, number];
export interface LMarker {
  setLatLng(p: LatLng): LMarker;
  setIcon(i: unknown): LMarker;
  bindTooltip(t: string): LMarker;
  addTo(m: LMap): LMarker;
  on(ev: string, fn: () => void): LMarker;
}
export interface LPolyline { addTo(m: LMap): LPolyline; remove(): void }
export interface LMap {
  setView(p: LatLng, zoom: number): LMap;
  fitBounds(b: unknown, opts?: object): LMap;
  getZoom(): number;
  remove(): void;
}
export interface Leaflet {
  map(el: HTMLElement, opts?: object): LMap;
  tileLayer(url: string, opts?: object): { addTo(m: LMap): unknown };
  divIcon(opts: object): unknown;
  marker(p: LatLng, opts?: object): LMarker;
  polyline(pts: LatLng[], opts?: object): LPolyline;
  latLngBounds(pts: LatLng[]): unknown;
}

let loading: Promise<Leaflet> | null = null;

export function loadLeaflet(): Promise<Leaflet> {
  const w = window as unknown as { L?: Leaflet };
  if (w.L) return Promise.resolve(w.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/vendor/leaflet/leaflet.css" });
      css.dataset.leaflet = "1";
      document.head.appendChild(css);
    }
    const js = Object.assign(document.createElement("script"), { src: "/vendor/leaflet/leaflet.js", async: true });
    js.onload = () => (w.L ? resolve(w.L) : reject(new Error("Leaflet didn't load")));
    js.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the map library"));
    };
    document.head.appendChild(js);
  });
  return loading;
}
