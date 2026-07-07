"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  question: string;
  options?: string[];
  correctAnswer: number | string;
  explanation: string;
  topic: string;
}

function QuizPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<"generate" | "quiz" | "result">(
    "generate",
  );
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [quizType, setQuizType] = useState<string>("");
  const [numberOfQuestions, setNumberOfQuestions] = useState<string>("");
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>(
    [],
  );
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number>(0);

  const { data: userDocuments = [], isLoading: isLoadingDocuments } =
    api.chat.listFiles.useQuery();

  const saveQuizAttemptMutation = api.chat.saveQuizAttempt.useMutation();

  const calculateScore = () => {
    let correct = 0;
    generatedQuestions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      if (userAnswer !== undefined) {
        if (question.options && question.options.length > 0) {
          if (parseInt(userAnswer) === question.correctAnswer) {
            correct++;
          }
        }
      }
    });
    return correct;
  };

  useEffect(() => {
    const docId = searchParams.get("docId");
    if (docId && userDocuments.length > 0) {
      const documentExists = userDocuments.some((doc) => doc.id === docId);
      if (documentExists) {
        setSelectedDocument(docId);
      }
    }
  }, [searchParams, userDocuments]);

  const generateQuizMutation = api.chat.generateQuiz.useMutation();
  const selectedDoc = userDocuments.find((doc) => doc.id === selectedDocument);

  const handleGenerateQuiz = async () => {
    if (!selectedDocument || !quizType || !numberOfQuestions) return;

    try {
      setIsGeneratingQuiz(true);
      const result = await generateQuizMutation.mutateAsync({
        fileId: selectedDocument,
        quizType: quizType as "MCQ" | "SAQ" | "LAQ",
        numberOfQuestions: parseInt(numberOfQuestions),
      });

      setGeneratedQuestions(result.questions as QuizQuestion[]);
      setCurrentQuestion(0);
      setStage("quiz");
    } catch (error) {
      console.error("Error generating quiz:", error);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleNewQuiz = () => {
    setStage("generate");
    setCurrentQuestion(0);
    setGeneratedQuestions([]);
    setSelectedDocument("");
    setQuizType("");
    setNumberOfQuestions("");
    setUserAnswers({});
    setQuizScore(0);
  };

  const currentQ = generatedQuestions[currentQuestion];
  const isMCQ = currentQ?.options && currentQ.options.length > 0;
  const scorePercent = Math.round(
    (quizScore / generatedQuestions.length) * 100,
  );

  return (
    <PageShell narrow>
      {/* Stage indicator */}
      <div className="quiz-stage-indicator animate-fade-up mb-8 justify-center">
        {(["generate", "quiz", "result"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "quiz-stage-dot",
                stage === s
                  ? "active"
                  : (["generate", "quiz", "result"].indexOf(stage) > i
                      ? "completed"
                      : "inactive"),
              )}
            />
            {i < 2 && (
              <div className="bg-muted-foreground/20 h-px w-8" />
            )}
          </div>
        ))}
      </div>

      {stage === "generate" && (
        <>
          <div className="hero-gradient animate-fade-up mb-8 rounded-2xl p-6 sm:p-8 text-center">
            <div className="bg-accent/15 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
              <BrainCircuit className="text-accent h-6 w-6" />
            </div>
            <h1 className="font-display text-foreground text-3xl tracking-tight sm:text-4xl">
              Generate a Quiz
            </h1>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
              Pick a document, choose your question style, and let AI build a
              personalized practice session.
            </p>
          </div>

          <div className="surface-card animate-fade-up space-y-6 rounded-2xl p-6 sm:p-8">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Document</Label>
              <Select
                value={selectedDocument}
                onValueChange={setSelectedDocument}
              >
                <SelectTrigger className="h-10 cursor-pointer">
                  <SelectValue
                    placeholder={
                      isLoadingDocuments
                        ? "Loading documents..."
                        : userDocuments.length === 0
                          ? "No documents uploaded"
                          : "Choose a document"
                    }
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={4}>
                  {isLoadingDocuments ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </SelectItem>
                  ) : userDocuments.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No documents found
                    </SelectItem>
                  ) : (
                    userDocuments.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quiz type</Label>
                <Select value={quizType} onValueChange={setQuizType}>
                  <SelectTrigger className="h-10 cursor-pointer">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={4}>
                    <SelectItem value="MCQ">Multiple choice</SelectItem>
                    <SelectItem value="SAQ">Short answer</SelectItem>
                    <SelectItem value="LAQ">Long answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Questions</Label>
                <Select
                  value={numberOfQuestions}
                  onValueChange={setNumberOfQuestions}
                >
                  <SelectTrigger className="h-10 cursor-pointer">
                    <SelectValue placeholder="Select count" />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={4}>
                    <SelectItem value="3">3 questions</SelectItem>
                    <SelectItem value="5">5 questions</SelectItem>
                    <SelectItem value="10">10 questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedDoc && (
              <div className="bg-accent/5 border-accent/20 flex items-center gap-3 rounded-xl border px-4 py-3">
                <div className="bg-accent/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <BrainCircuit className="text-accent h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {selectedDoc.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {(selectedDoc.size / 1024 / 1024).toFixed(1)} MB · Uploaded{" "}
                    {new Date(selectedDoc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerateQuiz}
              className="h-11 w-full text-[15px]"
              disabled={
                !selectedDocument ||
                !quizType ||
                !numberOfQuestions ||
                isLoadingDocuments ||
                userDocuments.length === 0 ||
                isGeneratingQuiz
              }
            >
              {isGeneratingQuiz ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate quiz"
              )}
            </Button>

            {userDocuments.length === 0 && !isLoadingDocuments && (
              <div className="text-center">
                <p className="text-muted-foreground mb-3 text-sm">
                  Upload documents first to generate quizzes.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard/documents")}
                >
                  Go to documents
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {stage === "quiz" && (
        <>
          <div className="animate-fade-up mb-6 flex items-end justify-between">
            <div>
              <span className="stat-chip mb-3 text-xs">
                {currentQ?.topic}
              </span>
              <h1 className="font-display text-foreground text-2xl tracking-tight sm:text-3xl">
                Question {currentQuestion + 1}
              </h1>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Progress
              </p>
              <p className="text-foreground text-lg font-semibold tabular-nums">
                {currentQuestion + 1}
                <span className="text-muted-foreground text-sm font-normal">
                  {" "}
                  / {generatedQuestions.length}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{
                  width: `${((currentQuestion + 1) / generatedQuestions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="surface-card animate-fade-up space-y-6 rounded-2xl p-6 sm:p-8">
            <p className="text-foreground text-[15px] leading-relaxed font-medium">
              {currentQ?.question}
            </p>

            {isMCQ ? (
              <RadioGroup
                className="space-y-2"
                value={userAnswers[currentQuestion] ?? ""}
                onValueChange={(value) => {
                  setUserAnswers((prev) => ({
                    ...prev,
                    [currentQuestion]: value,
                  }));
                }}
              >
                {currentQ.options?.map((option: string, idx: number) => (
                  <Label
                    key={idx}
                    htmlFor={`option-${idx}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-4 transition-all duration-200",
                      userAnswers[currentQuestion] === idx.toString()
                        ? "border-accent bg-accent/8 shadow-sm"
                        : "border-border hover:border-accent/30 hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem
                      value={idx.toString()}
                      id={`option-${idx}`}
                    />
                    <span className="text-foreground flex-1 text-sm">
                      {option}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            ) : (
              <Textarea
                placeholder="Type your answer here..."
                rows={6}
                className="resize-none"
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentQuestion(Math.max(0, currentQuestion - 1))
                }
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>
              {currentQuestion < generatedQuestions.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestion(currentQuestion + 1)}
                  className="flex-1"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    const score = calculateScore();
                    setQuizScore(score);

                    if (selectedDocument && quizType) {
                      try {
                        await saveQuizAttemptMutation.mutateAsync({
                          fileId: selectedDocument,
                          quizType: quizType as "MCQ" | "SAQ" | "LAQ",
                          numberOfQuestions: generatedQuestions.length,
                          score,
                          answers: userAnswers,
                          title: selectedDoc?.name
                            ? `Quiz: ${selectedDoc.name}`
                            : "Untitled Quiz",
                        });
                      } catch (error) {
                        console.error("Error saving quiz attempt:", error);
                      }
                    }

                    setStage("result");
                  }}
                  className="flex-1"
                >
                  Submit quiz
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {stage === "result" && (
        <>
          <div className="hero-gradient animate-fade-up mb-10 rounded-2xl p-8 text-center">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
              Your Score
            </p>
            <div
              className={cn(
                "font-display text-7xl tracking-tight tabular-nums",
                scorePercent >= 70
                  ? "text-accent"
                  : scorePercent >= 50
                    ? "text-foreground"
                    : "text-destructive",
              )}
            >
              {scorePercent}%
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {quizScore} of {generatedQuestions.length} correct
            </p>
            <div className="bg-muted mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  scorePercent >= 70
                    ? "bg-accent"
                    : scorePercent >= 50
                      ? "bg-muted-foreground/50"
                      : "bg-destructive",
                )}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          <div className="animate-fade-up mb-8 space-y-3">
            {generatedQuestions.map((q: QuizQuestion, idx: number) => {
              const userAnswer = userAnswers[idx];
              const isCorrect =
                userAnswer !== undefined &&
                (q.options && q.options.length > 0
                  ? parseInt(userAnswer) === q.correctAnswer
                  : false);

              return (
                <div key={idx} className="surface-card rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle2 className="text-accent mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <XCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground mb-3 text-sm font-medium leading-relaxed">
                        {q.question}
                      </p>
                      {q.options && q.options.length > 0 && (
                        <div className="text-muted-foreground mb-3 space-y-1 text-xs">
                          <p>
                            Your answer:{" "}
                            <span className="text-foreground font-medium">
                              {userAnswer !== undefined
                                ? q.options[parseInt(userAnswer)]
                                : "Not answered"}
                            </span>
                          </p>
                          <p>
                            Correct:{" "}
                            <span className="text-accent font-medium">
                              {typeof q.correctAnswer === "number"
                                ? q.options[q.correctAnswer]
                                : q.correctAnswer}
                            </span>
                          </p>
                        </div>
                      )}
                      <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleNewQuiz} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              New quiz
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </Button>
          </div>
        </>
      )}
    </PageShell>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <PageShell narrow>
          <div className="flex items-center justify-center py-24">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </PageShell>
      }
    >
      <QuizPageContent />
    </Suspense>
  );
}
