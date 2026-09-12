import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SoftPageHeader } from "@/components/SoftUI";
import { PostsGrid } from "@/components/feed/PostsGrid";

/* Bookmarked posts. */
export default function Saved() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["saved-posts"], queryFn: async () => (await api.get("/posts/saved")).data.posts });
  return (
    <div className="vo-neu-page flex min-h-full flex-col px-[clamp(14px,5cqi,20px)] pb-8" data-testid="saved-page">
      <SoftPageHeader title="Saved" onBack={() => navigate("/profile")} backTestId="saved-back-button" />
      <div className="mt-3">
        <PostsGrid posts={q.data} loading={q.isLoading} emptyTitle="Nothing saved yet" emptyText="Tap the bookmark on a post to keep it here." testId="saved-grid" />
      </div>
    </div>
  );
}
