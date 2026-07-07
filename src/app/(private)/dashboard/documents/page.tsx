"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/page-shell";
import {
  BrainCircuit,
  CloudUpload,
  FileText,
  HardDrive,
  MessageSquare,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { fileToBase64, cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  isUploading: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: documents = [],
    refetch: refetchFiles,
    isLoading: isLoadingFiles,
  } = api.chat.listFiles.useQuery();
  const uploadfileMutation = api.chat.uploadFiles.useMutation();
  const deleteFileMutation = api.chat.deleteFile.useMutation();

  const handleFileUpload = async (files: FileList) => {
    const newFiles = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      isUploading: true,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    const uploadPromises = newFiles.map(async (newFile) => {
      try {
        const originalFile = Array.from(files).find(
          (f) => f.name === newFile.name,
        );
        if (!originalFile) throw new Error("Original file not found");

        const base64 = await fileToBase64(originalFile);

        await uploadfileMutation.mutateAsync({
          base64Files: [
            {
              name: originalFile.name,
              type: originalFile.type,
              base64,
            },
          ],
        });

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === newFile.id ? { ...f, isUploading: false } : f,
          ),
        );
      } catch (error) {
        console.error("Error uploading file:", newFile.name, error);
        setUploadedFiles((prev) => prev.filter((f) => f.id !== newFile.id));
      }
    });

    await Promise.allSettled(uploadPromises);
    await refetchFiles();
    setUploadedFiles([]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles && selectedFiles.length > 0) {
      await handleFileUpload(selectedFiles);
      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const pdfFiles = Array.from(files).filter(
          (f) => f.type === "application/pdf",
        );
        if (pdfFiles.length > 0) {
          const dt = new DataTransfer();
          pdfFiles.forEach((f) => dt.items.add(f));
          setSelectedFiles(dt.files);
          await handleFileUpload(dt.files);
          setSelectedFiles(null);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFileMutation.mutateAsync({ fileId });
      void refetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const filesCurrentlyUploading = uploadedFiles.filter((file) => {
    const isInDocuments = documents.some((doc) => doc.name === file.name);
    return file.isUploading && !isInDocuments;
  });

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((doc) => doc.name.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const totalSizeMB = useMemo(
    () => documents.reduce((sum, doc) => sum + doc.size, 0) / 1024 / 1024,
    [documents],
  );

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <PageShell>
      {/* Hero */}
      <section className="hero-gradient animate-fade-up mb-8 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="bg-accent/15 flex h-8 w-8 items-center justify-center rounded-lg">
                <Sparkles className="text-accent h-4 w-4" />
              </div>
              <span className="text-accent text-xs font-semibold tracking-widest uppercase">
                Your Library
              </span>
            </div>
            <h1 className="font-display text-foreground text-3xl tracking-tight sm:text-4xl lg:text-5xl">
              Course Materials
            </h1>
            <p className="text-muted-foreground mt-2 max-w-md text-[15px] leading-relaxed">
              Upload PDFs, chat with your content, and generate quizzes — all
              in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="stat-chip">
              <FileText className="h-4 w-4" />
              <span>
                {isLoadingFiles ? "—" : documents.length}{" "}
                {documents.length === 1 ? "file" : "files"}
              </span>
            </div>
            <div className="stat-chip">
              <HardDrive className="h-4 w-4" />
              <span>
                {isLoadingFiles ? "—" : `${totalSizeMB.toFixed(1)} MB`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Upload zone */}
      <section className="animate-fade-up mb-10" style={{ animationDelay: "80ms" }}>
        <div
          className={cn("upload-zone p-8 sm:p-12", isDragOver && "drag-over")}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="flex flex-col items-center text-center">
            <div className="bg-accent/10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
              <CloudUpload className="text-accent h-8 w-8" />
            </div>
            <h2 className="text-foreground mb-2 text-lg font-semibold">
              Drop your PDFs here
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm leading-relaxed">
              Drag and drop course materials, or browse to select files. PDF
              only, up to 50 MB each.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Browse files
              </Button>
              {selectedFiles && selectedFiles.length > 0 && (
                <Button
                  onClick={handleUploadClick}
                  disabled={uploadfileMutation.isPending}
                  className="gap-2"
                >
                  <CloudUpload className="h-4 w-4" />
                  {uploadfileMutation.isPending
                    ? "Uploading..."
                    : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div className="border-border/60 mt-8 border-t pt-6">
              <p className="text-muted-foreground mb-3 text-center text-xs font-medium tracking-wider uppercase">
                Ready to upload
              </p>
              <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
                {Array.from(selectedFiles).map((file, index) => (
                  <span
                    key={index}
                    className="bg-background/80 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                  >
                    <FileText className="text-accent h-3 w-3" />
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {filesCurrentlyUploading.length > 0 && (
          <div className="border-accent/30 bg-accent/5 mt-4 rounded-xl border p-4">
            <div className="space-y-2">
              {filesCurrentlyUploading.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  <div className="border-accent border-t-transparent h-4 w-4 animate-spin rounded-full border-2" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    Uploading...
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* File library */}
      <section className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Your Documents
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {filteredDocuments.length} of {documents.length} shown
            </p>
          </div>

          {documents.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background h-10 pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {isLoadingFiles ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-muted/40 h-[76px] animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : documents.length === 0 && uploadedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
            <div className="bg-muted/60 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <FileText className="text-muted-foreground h-6 w-6" />
            </div>
            <h3 className="text-foreground text-lg font-medium">
              No documents yet
            </h3>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm leading-relaxed">
              Upload your first coursebook above to start chatting and taking
              quizzes.
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <Search className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              No documents match &ldquo;{searchQuery}&rdquo;
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc, i) => (
              <div
                key={doc.id}
                className="doc-row animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="bg-accent/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                  <FileText className="text-accent h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-foreground truncate font-medium">
                    {doc.name}
                  </h4>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {(doc.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {formatDate(doc.createdAt)}
                  </p>
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    onClick={() => router.push(`/chat?docId=${doc.id}`)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    onClick={() =>
                      router.push(`/dashboard/quiz?docId=${doc.id}`)
                    }
                  >
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Quiz
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-9 w-9 p-0 sm:hidden"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/chat?docId=${doc.id}`)}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Chat with document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/dashboard/quiz?docId=${doc.id}`)
                      }
                    >
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      Take a quiz
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteFile(doc.id)}
                      disabled={deleteFileMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hidden h-9 w-9 p-0 sm:flex"
                  onClick={() => handleDeleteFile(doc.id)}
                  disabled={deleteFileMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
