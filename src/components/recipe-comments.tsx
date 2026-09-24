"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/inputs";
import type { RecipeComment } from "@/lib/recipe-comments";

type RecipeCommentsProps = {
  recipeId: string;
  comments: RecipeComment[];
  viewerId: string | null;
  recipeOwnerId: string | null;
};

function CommentAuthor({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const [imageError, setImageError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase() || "?";

  return (
    <span data-testid="recipe-comment-author" className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-xs font-semibold text-primary"
      >
        {image && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            onError={() => setImageError(true)}
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          initials
        )}
      </span>
      <span className="truncate text-sm font-semibold text-foreground">{name}</span>
    </span>
  );
}

export function RecipeComments({
  recipeId,
  comments: initialComments,
  viewerId,
  recipeOwnerId,
}: RecipeCommentsProps) {
  const t = useTranslations("RecipeComments");
  const locale = useLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuPopoverRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [commentsState, setCommentsState] = useState({
    source: initialComments,
    value: initialComments,
  });
  const comments =
    commentsState.source === initialComments ? commentsState.value : initialComments;
  const updateComments = (update: (previous: RecipeComment[]) => RecipeComment[]) => {
    setCommentsState((previous) => {
      const current = previous.source === initialComments ? previous.value : initialComments;
      return { source: initialComments, value: update(current) };
    });
  };
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RecipeComment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (editingId) editTextareaRefs.current[editingId]?.focus();
  }, [editingId]);


  const postComment = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) throw new Error();
      const data: { comment: RecipeComment } = await response.json();
      updateComments((previous) =>
        [...previous, data.comment].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        ),
      );
      setDraft("");
      setStatus(t("posted"));
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  };

  const beginEdit = (comment: RecipeComment) => {
    setError(null);
    setStatus(null);
    setEditDraft(comment.body);
    setEditingId(comment.id);
  };

  const cancelEdit = (commentId: string) => {
    setEditingId(null);
    setEditDraft("");
    requestAnimationFrame(() => menuTriggerRefs.current[commentId]?.focus());
  };

  const saveEdit = async (commentId: string) => {
    const body = editDraft.trim();
    if (!body || body.length > 1000) {
      setError(t("invalid"));
      return;
    }
    setPendingActionId(commentId);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error();
      const data: { comment: RecipeComment } = await response.json();
      updateComments((previous) =>
        previous.map((comment) => (comment.id === commentId ? data.comment : comment)),
      );
      setEditingId(null);
      setEditDraft("");
      setStatus(t("edited"));
      requestAnimationFrame(() => menuTriggerRefs.current[commentId]?.focus());
    } catch {
      setError(t("error"));
    } finally {
      setPendingActionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const commentId = deleteTarget.id;
    setPendingActionId(commentId);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      updateComments((previous) => previous.filter((comment) => comment.id !== commentId));
      setDeleteTarget(null);
      setStatus(t("deleted"));
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setError(t("deleteError"));
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <section
      aria-labelledby={`recipe-comments-${recipeId}`}
      className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            ref={headingRef}
            id={`recipe-comments-${recipeId}`}
            tabIndex={-1}
            className="text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {t("heading")}
          </h2>
          {comments.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {t("count", { count: comments.length })}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol data-testid="recipe-comment-list" className="divide-y divide-border rounded-lg border border-border/60">
          {comments.map((comment) => {
            const canEdit = viewerId === comment.userId;
            const canDelete = canEdit || (!!recipeOwnerId && viewerId === recipeOwnerId);
            const editing = editingId === comment.id;
            const actionPending = pendingActionId === comment.id;
            return (
              <li key={comment.id} className="space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <CommentAuthor name={comment.authorName} image={comment.authorImage} />
                  <div className="flex items-center gap-1">
                    <time
                      dateTime={comment.createdAt}
                      className="text-xs text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(comment.createdAt))}
                    </time>
                    {(canEdit || canDelete) && !editing && (
                      <div className="relative">
                        <Button
                          ref={(element) => {
                            menuTriggerRefs.current[comment.id] = element;
                          }}
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                          aria-label={t("moreActionsFor", { name: comment.authorName })}
                          aria-expanded={openMenuId === comment.id}
                          aria-controls={`comment-actions-${comment.id}`}
                          popoverTarget={`comment-actions-${comment.id}`}
                          popoverTargetAction="toggle"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const panelWidth = 192;
                            const panelHeight = canEdit && canDelete ? 104 : 56;
                            const gutter = 8;
                            const gap = 4;
                            const left = Math.max(
                              gutter,
                              Math.min(
                                rect.right - panelWidth,
                                window.innerWidth - panelWidth - gutter,
                              ),
                            );
                            const below = rect.bottom + gap;
                            const top = below + panelHeight <= window.innerHeight - gutter
                              ? below
                              : Math.max(gutter, rect.top - panelHeight - gap);
                            setMenuPosition({ top, left });
                          }}
                          disabled={actionPending}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-4"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="19" cy="12" r="1.5" />
                            <circle cx="5" cy="12" r="1.5" />
                          </svg>
                        </Button>
                        <div
                          ref={(element) => {
                            menuPopoverRefs.current[comment.id] = element;
                          }}
                          id={`comment-actions-${comment.id}`}
                          popover="auto"
                          onToggle={(event) => {
                            const isOpen = event.currentTarget.matches(":popover-open");
                            setOpenMenuId((current) =>
                              isOpen ? comment.id : current === comment.id ? null : current,
                            );
                          }}
                          role="group"
                          aria-label={t("moreActionsFor", { name: comment.authorName })}
                          style={menuPosition}
                          className="fixed inset-auto z-20 m-0 w-48 rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur-md"
                        >
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              className="h-11 w-full justify-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                              aria-label={t("editFor", { name: comment.authorName })}
                              onClick={() => {
                                menuPopoverRefs.current[comment.id]?.hidePopover();
                                beginEdit(comment);
                              }}
                            >
                              {t("edit")}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              className="h-11 w-full justify-start text-red-600 hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:text-red-300"
                              aria-label={t("deleteFor", { name: comment.authorName })}
                              onClick={() => {
                                menuPopoverRefs.current[comment.id]?.hidePopover();
                                setError(null);
                                setDeleteTarget(comment);
                              }}
                            >
                              {t("delete")}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <Label htmlFor={`edit-comment-${comment.id}`}>
                      {t("editFor", { name: comment.authorName })}
                    </Label>
                    <Textarea
                      ref={(element) => {
                        editTextareaRefs.current[comment.id] = element;
                      }}
                      id={`edit-comment-${comment.id}`}
                      value={editDraft}
                      maxLength={1000}
                      onChange={(event) => setEditDraft(event.target.value)}
                      aria-describedby={`edit-count-${comment.id}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span id={`edit-count-${comment.id}`} className="text-xs text-muted-foreground">
                        {editDraft.length}/1000
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="md"
                          onClick={() => saveEdit(comment.id)}
                          disabled={actionPending || !editDraft.trim()}
                          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        >
                          {t("save")}
                        </Button>
                        <Button
                          type="button"
                          size="md"
                          variant="outline"
                          onClick={() => cancelEdit(comment.id)}
                          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                          disabled={actionPending}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                    {comment.body}
                  </p>
                )}

              </li>
            );
          })}
        </ol>
      )}

      {viewerId ? (
        <form onSubmit={postComment} className="space-y-2.5">
          <Label htmlFor={`new-comment-${recipeId}`}>{t("label")}</Label>
          <Textarea
            id={`new-comment-${recipeId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            aria-describedby={`comment-help-${recipeId} comment-count-${recipeId}`}
            maxLength={1000}
            required
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id={`comment-help-${recipeId}`} className="text-xs text-muted-foreground">
              {t("description")}
            </span>
            <span id={`comment-count-${recipeId}`} className="text-xs text-muted-foreground">
              {draft.length}/1000
            </span>
          </div>
          <Button
            type="submit"
            disabled={pending || !draft.trim()}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {pending ? t("posting") : t("post")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary underline underline-offset-2">
            {t("signIn")}
          </Link>
        </p>
      )}

      {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (pendingActionId === null) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isPending={pendingActionId !== null}
      />
    </section>
  );
}
