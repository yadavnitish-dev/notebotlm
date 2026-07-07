"use client";

import { useEffect, useRef, useState } from "react";
import { CitationPdfCanvas } from "@/components/pdf/citation-pdf-canvas";
import { usePdfFullText } from "@/hooks/use-pdf-full-text";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findBestTextMatch } from "@/lib/citation-highlight";

interface PdfViewerProps {
  fileUrl?: string;
  textToHighlight: string;
  initialPage?: number;
  fileId?: string;
  highlightRequestId: number;
}

export function PdfViewer({
  fileUrl,
  textToHighlight = "",
  initialPage,
  fileId,
  highlightRequestId,
}: PdfViewerProps) {
  const [activeTab, setActiveTab] = useState<"fulltext" | "pdf">("pdf");
  const highlightMarkerRef = useRef<HTMLSpanElement>(null);
  const pdfUrl =
    fileUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL +
      "/storage/v1/object/public/files/1758031653771-we8l23-Patent_US8126832.pdf";

  const {
    data: fullTextData,
    loading: fullTextLoading,
    error: fullTextError,
  } = usePdfFullText(fileId ?? null);

  useEffect(() => {
    setActiveTab("pdf");
  }, [textToHighlight, initialPage, pdfUrl]);

  useEffect(() => {
    if (activeTab !== "fulltext" || !textToHighlight || !fullTextData) return;

    const timer = setTimeout(() => {
      highlightMarkerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab, textToHighlight, fullTextData]);

  const renderHighlightedParagraph = (
    paragraphText: string,
    index: number,
    isHighlightParagraph: boolean,
  ) => {
    if (!textToHighlight || !isHighlightParagraph) {
      return (
        <p
          key={`para-${index}`}
          className="mb-8 text-[15px] leading-[1.8] tracking-[0.01em] text-gray-800 dark:text-gray-200"
        >
          {paragraphText}
        </p>
      );
    }

    const match = findBestTextMatch(paragraphText, textToHighlight);
    if (!match) {
      return (
        <p
          key={`para-${index}`}
          className="mb-8 text-[15px] leading-[1.8] tracking-[0.01em] text-gray-800 dark:text-gray-200"
        >
          {paragraphText}
        </p>
      );
    }

    const before = paragraphText.slice(0, match.index);
    const highlighted = paragraphText.slice(
      match.index,
      match.index + match.length,
    );
    const after = paragraphText.slice(match.index + match.length);

    return (
      <p
        key={`para-${index}`}
        className="mb-8 text-[15px] leading-[1.8] tracking-[0.01em] text-gray-800 dark:text-gray-200"
      >
        {before}
        <mark
          ref={highlightMarkerRef}
          data-citation-highlight
          className="citation-text-highlight"
        >
          {highlighted}
        </mark>
        {after}
      </p>
    );
  };

  const renderFormattedText = (text: string) => {
    const highlightMatch = textToHighlight
      ? findBestTextMatch(text, textToHighlight)
      : null;
    const highlightRange = highlightMatch
      ? {
          start: highlightMatch.index,
          end: highlightMatch.index + highlightMatch.length,
        }
      : null;

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let paragraphBuffer: string[] = [];
    let charOffset = 0;

    const flushParagraph = (index: number) => {
      if (paragraphBuffer.length === 0) return;

      const paragraphText = paragraphBuffer.join(" ").trim();
      const paragraphStart = charOffset;
      const paragraphEnd = charOffset + paragraphText.length;

      const overlapsHighlight =
        highlightRange !== null &&
        paragraphStart < highlightRange.end &&
        paragraphEnd > highlightRange.start;

      elements.push(
        renderHighlightedParagraph(paragraphText, index, overlapsHighlight),
      );

      charOffset = paragraphEnd;
      paragraphBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const pageMarkerMatch = /^--- Page (\d+) ---$/.exec(line);
      if (pageMarkerMatch) {
        flushParagraph(i);

        const pageNum = pageMarkerMatch[1];
        charOffset += line.length + 1;
        elements.push(
          <div key={`page-${pageNum}-${i}`} className="my-16 flex items-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600"></div>
            <div className="mx-6 flex items-center space-x-2 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Page {pageNum}</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600"></div>
          </div>,
        );
        continue;
      }

      if (line.trim() === "") {
        flushParagraph(i);
        charOffset += line.length + 1;
        continue;
      }

      paragraphBuffer.push(line.trim());
      charOffset += line.length + 1;
    }

    flushParagraph(lines.length);

    return elements;
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <Button
          variant={activeTab === "fulltext" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("fulltext")}
          className={`rounded-none border-b-2 px-6 py-3 font-medium transition-all ${
            activeTab === "fulltext"
              ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-400"
              : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          }`}
        >
          Full Text
        </Button>
        <Button
          variant={activeTab === "pdf" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("pdf")}
          className={`rounded-none border-b-2 px-6 py-3 font-medium transition-all ${
            activeTab === "pdf"
              ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-400"
              : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          }`}
        >
          PDF Viewer
        </Button>
      </div>

      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
        {activeTab === "fulltext" ? (
          <div className="h-full bg-gray-50 dark:bg-gray-950">
            {fullTextLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
                  <p className="text-muted-foreground">
                    Loading document text...
                  </p>
                </div>
              </div>
            ) : fullTextError ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-destructive text-center">
                  <p className="mb-2">Failed to load document text</p>
                  <p className="text-muted-foreground text-sm">
                    {fullTextError}
                  </p>
                </div>
              </div>
            ) : fullTextData ? (
              <ScrollArea className="h-full">
                <div className="mx-auto max-w-3xl px-8 py-8">
                  <div className="mb-8 border-b border-gray-200 pb-6 dark:border-gray-700">
                    <h1 className="mb-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                      {fullTextData.fileName}
                    </h1>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{fullTextData.pageCount} pages</span>
                      <span>Full text extracted</span>
                    </div>
                  </div>
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <div className="text-content space-y-2">
                      {renderFormattedText(fullTextData.fullText)}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">No document selected</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full">
            <CitationPdfCanvas
              key={pdfUrl}
              pdfUrl={pdfUrl}
              textToHighlight={textToHighlight}
              initialPage={initialPage}
              highlightRequestId={highlightRequestId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
