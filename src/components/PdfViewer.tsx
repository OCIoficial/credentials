import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  data: Uint8Array;
}

/** Renders every page of a PDF to canvases using pdf.js. */
export function PdfViewer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width === 0) return;
    let cancelled = false;
    // pdf.js takes ownership of the buffer, so give it a copy.
    const task = pdfjs.getDocument({ data: data.slice() });
    setError(null);

    (async () => {
      const pdf = await task.promise;
      if (cancelled) return;
      setPages(pdf.numPages);
      el.replaceChildren();
      const dpr = window.devicePixelRatio || 1;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const cssWidth = Math.min(width - 16, 900) * zoom;
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page";
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${(cssWidth * base.height) / base.width}px`;
        canvas.setAttribute("aria-label", `Page ${n}`);
        el.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [data, width, zoom]);

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <span className="muted">
          {pages} {pages === 1 ? "page" : "pages"}
        </span>
        <div className="row">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">
            −
          </button>
          <span className="zoom">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
      {error && <div className="error">Could not render preview: {error}</div>}
      <div className="pages" ref={containerRef} />
    </div>
  );
}
