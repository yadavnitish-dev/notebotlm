"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import {
  type LoadError,
  type PageChangeEvent,
  type PdfJs,
  type Plugin,
  type PluginOnTextLayerRender,
  Viewer,
  Worker,
} from "@react-pdf-viewer/core";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import { searchPlugin } from "@react-pdf-viewer/search";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

import {
  buildSearchAttempts,
  textMatchesSearch,
} from "@/lib/citation-highlight";

interface CitationPdfCanvasProps {
  pdfUrl: string;
  textToHighlight: string;
  initialPage?: number;
  highlightRequestId: number;
}

interface PendingHighlight {
  pageIndex: number;
  keywords: string[];
}

async function getPdfPageText(doc: PdfJs.PdfDocument, pageNum: number) {
  const pdfPage = await doc.getPage(pageNum);
  const textContent = await pdfPage.getTextContent();
  return textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
}

async function findCitationInPdf(
  doc: PdfJs.PdfDocument,
  searchText: string,
  hintPage?: number,
) {
  const attempts = buildSearchAttempts(searchText);
  if (attempts.length === 0) return null;

  const tryPage = async (pageNum: number) => {
    const pageText = await getPdfPageText(doc, pageNum);
    for (const attempt of attempts) {
      if (textMatchesSearch(pageText, attempt)) {
        return { page: pageNum, searchText: attempt };
      }
    }
    return null;
  };

  if (hintPage && hintPage >= 1 && hintPage <= doc.numPages) {
    const hintMatch = await tryPage(hintPage);
    if (hintMatch) return hintMatch;
  }

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    if (pageNum === hintPage) continue;
    const match = await tryPage(pageNum);
    if (match) return match;
  }

  return null;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function styleSearchHighlight(props: { highlightEle: HTMLElement }) {
  props.highlightEle.classList.add("citation-pdf-highlight");
}

function hasRenderedTextLayer() {
  const layers = document.querySelectorAll(
    ".source-document-pdf-viewer .rpv-core__text-layer",
  );
  if (layers.length === 0) return false;

  return Array.from(layers).some(
    (layer) => layer.textContent && layer.textContent.trim().length > 0,
  );
}

const textLayerReadyPlugin: Plugin = {
  onTextLayerRender(props: PluginOnTextLayerRender) {
    textLayerReadyHandlerRef.current?.(props);
  },
};

const textLayerReadyHandlerRef: {
  current: ((props: PluginOnTextLayerRender) => void) | null;
} = { current: null };

/**
 * Plugin factories from @react-pdf-viewer call React hooks internally.
 * They must be invoked at the top level of a component — never inside useMemo/useEffect.
 */
const CitationPdfCanvasInner = memo(function CitationPdfCanvasInner({
  pdfUrl,
  textToHighlight,
  initialPage,
  highlightRequestId,
}: CitationPdfCanvasProps) {
  const docRef = useRef<PdfJs.PdfDocument | null>(null);
  const citationRef = useRef({ textToHighlight, initialPage });
  const pendingHighlightRef = useRef<PendingHighlight | null>(null);
  const highlightRunIdRef = useRef(0);

  citationRef.current = { textToHighlight, initialPage };

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const searchPluginInstance = searchPlugin({
    onHighlightKeyword: styleSearchHighlight,
  });

  const pageNavigationRef = useRef(pageNavigationPluginInstance);
  const searchPluginRef = useRef(searchPluginInstance);
  pageNavigationRef.current = pageNavigationPluginInstance;
  searchPluginRef.current = searchPluginInstance;

  const applyPendingHighlight = useCallback(async () => {
    const pending = pendingHighlightRef.current;
    if (!pending) return false;

    searchPluginRef.current.clearHighlights();
    const results = await searchPluginRef.current.highlight(pending.keywords);
    if (results.length > 0) {
      searchPluginRef.current.jumpToNextMatch();
      pendingHighlightRef.current = null;
      return true;
    }

    return false;
  }, []);

  const scheduleCitationHighlight = useCallback(
    async (doc: PdfJs.PdfDocument) => {
      const { textToHighlight: text, initialPage: page } = citationRef.current;
      if (!text.trim()) return;

      const runId = ++highlightRunIdRef.current;
      const match = await findCitationInPdf(doc, text, page);
      if (!match || runId !== highlightRunIdRef.current) return;

      const pageIndex = match.page - 1;
      pendingHighlightRef.current = {
        pageIndex,
        keywords: buildSearchAttempts(match.searchText),
      };

      pageNavigationRef.current.jumpToPage(pageIndex);

      for (let attempt = 0; attempt < 12; attempt++) {
        if (runId !== highlightRunIdRef.current) return;

        await wait(150 * (attempt + 1));

        if (!hasRenderedTextLayer()) continue;

        const highlighted = await applyPendingHighlight();
        if (highlighted) return;
      }
    },
    [applyPendingHighlight],
  );

  textLayerReadyHandlerRef.current = (props) => {
    const pending = pendingHighlightRef.current;
    if (!pending || props.pageIndex !== pending.pageIndex) return;

    requestAnimationFrame(() => {
      void applyPendingHighlight();
    });
  };

  const handleDocumentLoad = useCallback(
    (e: { doc: PdfJs.PdfDocument }) => {
      docRef.current = e.doc;
      void scheduleCitationHighlight(e.doc);
    },
    [scheduleCitationHighlight],
  );

  const handlePageChange = useCallback(
    (e: PageChangeEvent) => {
      const pending = pendingHighlightRef.current;
      if (!pending || e.currentPage !== pending.pageIndex) return;

      requestAnimationFrame(() => {
        void applyPendingHighlight();
      });
    },
    [applyPendingHighlight],
  );

  useEffect(() => {
    if (docRef.current) {
      void scheduleCitationHighlight(docRef.current);
    }
  }, [
    highlightRequestId,
    textToHighlight,
    initialPage,
    scheduleCitationHighlight,
  ]);

  const renderPdfError = useCallback((error: LoadError) => {
    const message = error.message ?? "Unable to load the source document.";
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-destructive max-w-md text-center">
          <p className="mb-2 font-medium">Failed to load PDF</p>
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      </div>
    );
  }, []);

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
      <div className="source-document-pdf-viewer h-full">
        <Viewer
          fileUrl={pdfUrl}
          onDocumentLoad={handleDocumentLoad}
          onPageChange={handlePageChange}
          renderError={renderPdfError}
          plugins={[
            defaultLayoutPluginInstance,
            pageNavigationPluginInstance,
            searchPluginInstance,
            textLayerReadyPlugin,
          ]}
        />
      </div>
    </Worker>
  );
});

export function CitationPdfCanvas(props: CitationPdfCanvasProps) {
  return <CitationPdfCanvasInner {...props} />;
}
