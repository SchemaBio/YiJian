declare module 'igv' {
  export interface IGVTrackView {
    track: {type?: string; height: number; autoHeight?: boolean; coverageTrackHeight?: number};
    setTrackHeight(height: number, force?: boolean): void;
  }
  export interface IGVBrowser {
    trackViews?: IGVTrackView[];
    search(locus: string): Promise<void>;
    loadTrack(config: TrackConfig): Promise<unknown>;
    updateViews(): Promise<void>;
    currentLoci(): string | string[];
    removeTrackByName(name: string): void;
    toSVG(): string;
    dispose(): void;
  }

  export interface TrackConfig {
    type: string;
    format?: string;
    url?: string | (() => Promise<string>);
    indexURL?: string | (() => Promise<string>);
    name?: string;
    height?: number;
    [key: string]: any;
  }

  export interface IGVOptions {
    genome?: string;
    locus?: string;
    tracks?: TrackConfig[];
    reference?: {
      id: string;
      fastaURL: string;
      indexURL?: string;
      cytobandURL?: string;
    };
    [key: string]: any;
  }

  const igv: {
    createBrowser(container: HTMLElement, options: IGVOptions): Promise<IGVBrowser>;
    removeBrowser(browser: IGVBrowser): void;
    removeAllBrowsers(): void;
  };

  export default igv;
}

declare module 'igv/dist/igv.esm.js' {
  export type IGVBrowser = import('igv').IGVBrowser;
  export type IGVTrackConfig = import('igv').TrackConfig;
  export type IGVOptions = import('igv').IGVOptions;
  const igv: {
    createBrowser(container: HTMLElement, options: IGVOptions): Promise<IGVBrowser>;
    removeBrowser(browser: IGVBrowser): void;
    removeAllBrowsers(): void;
  };
  export default igv;
}
