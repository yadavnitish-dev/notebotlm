"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Streamdown } from "streamdown";
import rehypeRaw from "rehype-raw";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat/chat-input";
import { CitationBadge } from "@/components/chat/citation-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfViewer } from "@/components/pdf/pdf-viewer";

const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

interface ChatComponentProps {
  chatId?: string;
  initialDocId?: string;
}
interface CitationData {
  citedText: string;
  pageNumber?: number;
  fileUrl: string;
  sourceId: string;
  fileId: string;
  requestId: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  isUploading: boolean;
}

const SCROLL_BOTTOM_THRESHOLD = 80;

function decodeCitationText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

export function ChatComponent({ chatId, initialDocId }: ChatComponentProps) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const hasInitializedDoc = useRef(false);
  const router = useRouter();
  const [citationData, setCitationData] = useState<CitationData | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [lastSubmittedFiles, setLastSubmittedFiles] = useState<UploadedFile[]>(
    [],
  );
  const utils = api.useUtils();

  const { data: chatData } = api.chat.getById.useQuery(
    { id: chatId! },
    { enabled: !!chatId },
  );

  const { data: userFiles } = api.chat.listFiles.useQuery(undefined, {
    enabled: !!initialDocId && !chatId,
  });

  useEffect(() => {
    if (!initialDocId || chatId || hasInitializedDoc.current || !userFiles) {
      return;
    }

    const doc = userFiles.find((file) => file.id === initialDocId);
    if (doc) {
      setUploadedFiles([
        {
          id: doc.id,
          name: doc.name,
          type: doc.fileType,
          isUploading: false,
        },
      ]);
      hasInitializedDoc.current = true;
    }
  }, [initialDocId, chatId, userFiles]);

  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          message: messages.at(-1)?.parts.find((part) => part.type === "text")
            ?.text,
          chatId,
          ...body,
        },
      }),
    }),
    onData: (data) => {
      if (data.type === "data-chatId") {
        const newChatId = (data.data as { chatId: string }).chatId;
        utils.chat.getById
          .prefetch({ id: newChatId })
          .then(() => {
            router.push(`/chat/${newChatId}`);
          })
          .catch((e) => {
            console.error("Error in prefetch:", e);
          });
      }
    },
    onFinish: () => {
      void utils.chat.getById.invalidate();
      setLastSubmittedFiles([]);
    },
  });

  useEffect(() => {
    if (
      !chatData?.messages ||
      status === "submitted" ||
      status === "streaming"
    ) {
      return;
    }

    const uiMessages: UIMessage[] = chatData.messages.map((message) => ({
      id: message.id,
      role:
        message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
      createdAt: message.createdAt,
      parts: [{ type: "text", text: message.content }],
    }));
    setMessages(uiMessages);
  }, [chatData?.messages, setMessages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const lastMessage = messages[messages.length - 1];
  const hasResponseContent =
    lastMessage?.role === "assistant" &&
    lastMessage.parts?.some(
      (part) => part.type === "text" && part.text && part.text.length > 0,
    );

  const isWaitingForResponse =
    (status === "submitted" || status === "streaming") && !hasResponseContent;

  const handleCitationClick = ({
    citedText,
    pageNumber,
    fileId,
    sourceId,
    messageId,
  }: {
    messageId: string;
    citedText: string;
    pageNumber: number;
    fileId: string;
    sourceId: string;
  }) => {
    let resolvedFileId = fileId;

    if (!resolvedFileId) {
      const message = chatData?.messages.find((msg) => msg.id === messageId);
      const fromSourceIndex = message?.messageSources[+sourceId - 1];
      const fromSourceMatch = message?.messageSources.find(
        (source) => source.fileId === fileId,
      );
      resolvedFileId =
        fromSourceMatch?.fileId ?? fromSourceIndex?.fileId ?? "";
    }

    if (!resolvedFileId) {
      const chatFile = chatData?.messages
        .flatMap((msg) => msg.messageSources)
        .find((source) => source.fileId === fileId)?.fileId;
      resolvedFileId = chatFile ?? "";
    }

    if (!resolvedFileId && lastSubmittedFiles.length > 0) {
      resolvedFileId = lastSubmittedFiles[0]?.id ?? "";
    }

    if (!resolvedFileId && uploadedFiles.length > 0) {
      resolvedFileId =
        uploadedFiles.find((file) => !file.isUploading)?.id ?? "";
    }

    const normalizedCitedText = decodeCitationText(citedText);
    if (!resolvedFileId || !normalizedCitedText) return;

    const validPage =
      Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : undefined;

    setCitationData({
      citedText: normalizedCitedText,
      pageNumber: validPage,
      fileUrl: `/api/pdf/file?fileId=${resolvedFileId}`,
      sourceId,
      fileId: resolvedFileId,
      requestId: Date.now(),
    });
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    isProgrammaticScrollRef.current = true;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, []);

  const handleViewportScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldAutoScrollRef.current =
      distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  useLayoutEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current && isLoading) {
        scrollToBottom();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isLoading, scrollToBottom]);

  const handleMessageSubmit = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    shouldAutoScrollRef.current = true;

    const fileIds = uploadedFiles
      .filter((file) => !file.isUploading)
      .map((file) => file.id);

    const filesToSubmit = uploadedFiles.filter((file) => !file.isUploading);
    setLastSubmittedFiles(filesToSubmit);

    setUploadedFiles([]);

    await sendMessage({ text: messageText }, { body: { fileIds } });
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={citationData ? 60 : 100} minSize={40}>
          <div className="flex h-full min-h-0 flex-col">
            <ScrollArea
              className="min-h-0 flex-1 px-4 py-6 [overflow-anchor:none]"
              viewportRef={scrollViewportRef}
              onViewportScroll={handleViewportScroll}
            >
              {messages.length === 0 ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
                  <p className="font-display text-foreground text-3xl tracking-tight sm:text-4xl">
                    What would you like to research?
                  </p>
                  <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
                    Ask questions about your documents, explore topics, or
                    upload PDFs for cited answers.
                  </p>
                </div>
              ) : (
                <div
                  ref={messagesContainerRef}
                  className="mx-auto max-w-4xl space-y-4"
                  style={{ overflowAnchor: "none" }}
                >
                  {messages.map((message, _index) => {
                    const messageData = chatData?.messages.find(
                      (msg) => msg.id === message.id,
                    );

                    const isNewMessage = !messageData;

                    let filesToDisplay: Array<{
                      file: { id: string; name: string };
                    }> = [];

                    if (messageData?.messageFiles) {
                      filesToDisplay = messageData.messageFiles;
                    } else if (isNewMessage && message.role === "user") {
                      if (isLoading && lastSubmittedFiles.length > 0) {
                        filesToDisplay = lastSubmittedFiles.map((f) => ({
                          file: { id: f.id, name: f.name },
                        }));
                      } else if (!isLoading && uploadedFiles.length > 0) {
                        filesToDisplay = uploadedFiles
                          .filter((f) => !f.isUploading)
                          .map((f) => ({ file: { id: f.id, name: f.name } }));
                      }
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`flex space-x-2 ${
                            message.role === "user"
                              ? "max-w-[80%] flex-row-reverse space-x-reverse"
                              : ""
                          }`}
                        >
                          <div
                            className={
                              message.role === "user"
                                ? "chat-message-user max-w-[85%]"
                                : "chat-message-assistant max-w-full"
                            }
                          >
                            {/* Display attached files */}
                            {filesToDisplay.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {filesToDisplay.map((messageFile) => (
                                  <div
                                    key={messageFile.file.id}
                                    className="border-border bg-card flex items-center space-x-2 rounded-xl border px-3 py-2 shadow-sm"
                                  >
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500">
                                      <svg
                                        className="h-4 w-4 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-card-foreground max-w-[150px] truncate text-xs font-medium">
                                        {messageFile.file.name}
                                      </p>
                                      <p className="text-muted-foreground text-xs">
                                        PDF
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="chat-message-content">
                              {message.parts
                                ?.filter((part) => part.type === "text")
                                .map((part, _index) => (
                                  <Streamdown
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                      // @ts-expect-error dynamic props
                                      citation: ({
                                        children,
                                        ...rest
                                      }: {
                                        children: React.ReactNode;
                                        "cited-text": string;
                                        "file-page-number": string | number;
                                        "file-id": string;
                                        "source-id": string;
                                      }) => {
                                        const label =
                                          typeof children === "string" ||
                                          typeof children === "number"
                                            ? String(children).replace(
                                                /[\[\]]/g,
                                                "",
                                              )
                                            : "•";

                                        return (
                                          <CitationBadge
                                            label={label}
                                            citedText={rest["cited-text"] ?? ""}
                                            onClick={() =>
                                              handleCitationClick({
                                                messageId: message.id,
                                                citedText:
                                                  rest["cited-text"] ?? "",
                                                pageNumber: Number(
                                                  rest["file-page-number"],
                                                ),
                                                fileId: rest["file-id"],
                                                sourceId: rest["source-id"],
                                              })
                                            }
                                          />
                                        );
                                      },
                                    }}
                                    key={_index}
                                  >
                                    {part.text}
                                  </Streamdown>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Loading indicator before response starts */}
                  {isWaitingForResponse && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-1.5 px-1 py-3">
                        <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                        <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                        <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <ChatInput
              onSubmit={handleMessageSubmit}
              disabled={isLoading}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />
          </div>
        </ResizablePanel>

        {citationData && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="border-border bg-card flex h-full flex-col border-l">
                <div className="bg-muted/50 border-border flex items-center justify-between border-b p-4">
                  <h2 className="text-card-foreground text-sm font-medium">
                    Source Document
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCitationData(null)}
                  >
                    <XIcon />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PdfViewer
                    textToHighlight={citationData.citedText}
                    initialPage={citationData.pageNumber}
                    fileUrl={citationData.fileUrl}
                    fileId={citationData.fileId}
                    highlightRequestId={citationData.requestId}
                  />
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
