import React, { useState, useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";
import { 
  useGetEmails, 
  useGetEmailDigest, 
  useSummarizeEmails, 
  getGetEmailsQueryKey, 
  getGetEmailDigestQueryKey 
} from "@workspace/api-client-react";
import type { Email, EmailSummary } from "@workspace/api-client-react/src/generated/api.schemas";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Loader2, Mail, CheckCircle2, AlertCircle, ArrowRight, XCircle, Inbox, Link as LinkIcon, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [date, setDate] = useState<Date>(subDays(new Date(), 14));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summaries, setSummaries] = useState<EmailSummary[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [filter, setFilter] = useState<"all" | "needs-reply" | "high-priority" | "unread">("all");

  const isoDate = date.toISOString();

  // Queries
  const { 
    data: emails, 
    isLoading: emailsLoading, 
    error: emailsError,
    refetch: refetchEmails
  } = useGetEmails({ since: isoDate }, { 
    query: { 
      enabled: hasStarted, 
      queryKey: getGetEmailsQueryKey({ since: isoDate }),
      retry: false
    } 
  });

  const { 
    data: digest, 
    isLoading: digestLoading,
    error: digestError
  } = useGetEmailDigest({ since: isoDate }, { 
    query: { 
      enabled: hasStarted, 
      queryKey: getGetEmailDigestQueryKey({ since: isoDate }),
      retry: false
    } 
  });

  const summarizeMutation = useSummarizeEmails();

  const handleStart = () => {
    setHasStarted(true);
    setIsAnalyzing(true);
    setSummaries([]);
    refetchEmails().then((result) => {
      if (result.data && result.data.length > 0) {
        summarizeMutation.mutate({ data: { emails: result.data } }, {
          onSuccess: (data) => {
            setSummaries(data);
            setIsAnalyzing(false);
          },
          onError: () => {
            setIsAnalyzing(false);
          }
        });
      } else {
        setIsAnalyzing(false);
      }
    });
  };

  const isAuthError = (emailsError as any)?.response?.status === 401 || (digestError as any)?.response?.status === 401;

  const enrichedEmails = useMemo(() => {
    if (!emails) return [];
    return emails.map(email => {
      const summary = summaries.find(s => s.emailId === email.id);
      return { ...email, aiSummary: summary };
    });
  }, [emails, summaries]);

  const filteredEmails = useMemo(() => {
    let result = enrichedEmails;
    if (filter === "needs-reply") {
      result = result.filter(e => e.aiSummary?.needsReply);
    } else if (filter === "high-priority") {
      result = result.filter(e => e.aiSummary?.urgency === "high");
    } else if (filter === "unread") {
      result = result.filter(e => !e.isRead);
    }

    // Sort: Needs reply first, then by urgency, then by date
    return result.sort((a, b) => {
      if (a.aiSummary?.needsReply && !b.aiSummary?.needsReply) return -1;
      if (!a.aiSummary?.needsReply && b.aiSummary?.needsReply) return 1;
      
      const urgencyScore = { high: 3, medium: 2, low: 1 };
      const aUrgency = a.aiSummary?.urgency ? urgencyScore[a.aiSummary.urgency] : 0;
      const bUrgency = b.aiSummary?.urgency ? urgencyScore[b.aiSummary.urgency] : 0;
      
      if (aUrgency !== bUrgency) return bUrgency - aUrgency;
      
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
  }, [enrichedEmails, filter]);


  return (
    <div className="min-h-screen flex flex-col items-center p-6 md:p-12 w-full max-w-5xl mx-auto">
      <header className="w-full mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-serif text-foreground font-semibold flex items-center gap-2">
            <Inbox className="w-8 h-8 text-primary" />
            Inbox Digest
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">Your calm, prioritized catch-up assistant.</p>
        </div>

        <div className="flex items-center gap-4 bg-card p-2 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 px-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">I was away since:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start text-left font-normal border-0 shadow-none hover:bg-muted">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <Button 
            onClick={handleStart} 
            disabled={isAnalyzing || emailsLoading || summarizeMutation.isPending}
            className="rounded-lg px-6"
          >
            {isAnalyzing || emailsLoading || summarizeMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
            ) : (
              <><RefreshCcw className="w-4 h-4 mr-2" /> Catch Me Up</>
            )}
          </Button>
        </div>
      </header>

      {isAuthError && (
        <Card className="w-full bg-orange-50/50 border-orange-200 shadow-sm mt-4">
          <CardContent className="pt-6 flex flex-col items-center text-center p-12">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
              <LinkIcon className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-orange-900 mb-2">Connect your Outlook account</h2>
            <p className="text-orange-700/80 max-w-md mx-auto mb-6">
              To fetch and analyze your emails, Inbox Digest needs access to your Outlook inbox. Please connect your account in the settings to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {hasStarted && !isAuthError && (
        <div className="w-full flex flex-col gap-8">
          
          {(isAnalyzing || emailsLoading || digestLoading) && !summaries.length && (
             <div className="w-full flex flex-col items-center justify-center py-24 text-muted-foreground">
               <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
               <h3 className="text-xl font-medium text-foreground">Reading your inbox...</h3>
               <p className="mt-2 text-sm max-w-sm text-center">We're fetching your emails and using AI to summarize and prioritize them. This might take a moment.</p>
             </div>
          )}

          {!isAnalyzing && !emailsLoading && digest && summaries.length > 0 && (
            <>
              {/* Stats Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                <Card className="bg-card shadow-sm border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Emails</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">{digest.totalEmails}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unread</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">{digest.unreadEmails}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Needs Reply</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-primary">{digest.needsReplyCount}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-destructive/20 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider">High Urgency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-destructive">{digest.highUrgencyCount}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col md:flex-row gap-8 w-full items-start">
                
                {/* Main Email List */}
                <div className="w-full md:w-3/4 flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium font-serif">Your Digest</h2>
                    <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
                      <Button variant={filter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("all")} className="rounded-md">All</Button>
                      <Button variant={filter === "needs-reply" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("needs-reply")} className="rounded-md">Needs Reply</Button>
                      <Button variant={filter === "high-priority" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("high-priority")} className="rounded-md">High Priority</Button>
                      <Button variant={filter === "unread" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("unread")} className="rounded-md">Unread</Button>
                    </div>
                  </div>

                  {filteredEmails.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p>No emails match your filter. You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {filteredEmails.map(email => (
                        <Card key={email.id} className={`overflow-hidden transition-all duration-200 border-l-4 ${email.aiSummary?.urgency === 'high' ? 'border-l-destructive shadow-sm' : email.aiSummary?.needsReply ? 'border-l-primary shadow-sm' : 'border-l-transparent border-border/50'}`}>
                          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{email.from}</span>
                                <span className="text-sm text-muted-foreground">&lt;{email.fromEmail}&gt;</span>
                              </div>
                              <CardTitle className={`text-lg ${!email.isRead ? 'font-bold' : 'font-medium'}`}>{email.subject}</CardTitle>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(email.receivedAt), "MMM d, h:mm a")}</span>
                              <div className="flex gap-2">
                                {email.aiSummary?.urgency === 'high' && <Badge variant="destructive">High Priority</Badge>}
                                {email.aiSummary?.needsReply && <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground">Needs Reply</Badge>}
                                {!email.isRead && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Unread</Badge>}
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="pb-4">
                            {email.aiSummary ? (
                              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 flex flex-col gap-3">
                                <div>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">AI Summary</h4>
                                  <p className="text-sm leading-relaxed">{email.aiSummary.summary}</p>
                                </div>
                                
                                {email.aiSummary.keyPoints && email.aiSummary.keyPoints.length > 0 && (
                                  <div className="mt-2">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Key Points</h4>
                                    <ul className="text-sm space-y-1 pl-5 list-disc text-foreground/80 marker:text-muted-foreground">
                                      {email.aiSummary.keyPoints.map((kp, i) => (
                                        <li key={i}>{kp}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {email.aiSummary.suggestedAction && (
                                  <div className="mt-2 flex items-start gap-2 text-sm bg-primary/5 text-primary-foreground p-3 rounded-md border border-primary/10">
                                    <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                    <span className="text-foreground"><strong>Suggested Action:</strong> {email.aiSummary.suggestedAction}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic line-clamp-2">{email.bodyPreview}</p>
                            )}
                          </CardContent>
                          
                          {email.webLink && (
                            <CardFooter className="pt-0 justify-end">
                              <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5" onClick={() => window.open(email.webLink || '', '_blank')}>
                                Open in Outlook <ArrowRight className="ml-2 w-3 h-3" />
                              </Button>
                            </CardFooter>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="w-full md:w-1/4 flex flex-col gap-6">
                  <Card className="bg-card shadow-sm border-border/50 sticky top-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Top Senders</CardTitle>
                      <CardDescription>Who emailed you the most</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-4">
                        {digest.topSenders.slice(0, 5).map((sender, idx) => (
                          <li key={idx} className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate pr-4">{sender.sender}</span>
                            <Badge variant="secondary" className="shrink-0">{sender.count}</Badge>
                          </li>
                        ))}
                        {digest.topSenders.length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No data available</li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
