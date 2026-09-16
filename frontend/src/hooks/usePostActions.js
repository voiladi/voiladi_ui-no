import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errMsg } from "@/lib/api";
import { notice } from "@/lib/feedback";

/*
 * Everything a post can do, shared by Discover, the single-post screen and Saved:
 * optimistic like / save, follow (the app's like-swipe), not interested, report, delete, and the sheets' open state.
 */
export const usePostActions = (setPosts) => {
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [moreFor, setMoreFor] = useState(null);
  const [reportFor, setReportFor] = useState(null);
  const [author, setAuthor] = useState(null);
  const [match, setMatch] = useState(null);

  const patch = useCallback((id, fn) => setPosts((list) => (list || []).map((p) => (p.id === id ? { ...p, ...fn(p) } : p))), [setPosts]);
  const drop = useCallback((id) => setPosts((list) => (list || []).filter((p) => p.id !== id)), [setPosts]);

  const like = useCallback(
    async (post) => {
      const was = post.liked;
      const hidden = post.likes == null; // author hid the count - keep it hidden
      const bump = (p, d) => (hidden ? null : Math.max(0, (p.likes || 0) + d));
      patch(post.id, (p) => ({ liked: !was, likes: bump(p, was ? -1 : 1) }));
      try {
        const { data } = await api.post(`/posts/${post.id}/like`);
        patch(post.id, () => ({ liked: data.liked, likes: hidden ? null : data.likes }));
      } catch (e) {
        patch(post.id, (p) => ({ liked: was, likes: bump(p, was ? 1 : -1) }));
        notice(errMsg(e));
      }
    },
    [patch]
  );

  const save = useCallback(
    async (post) => {
      const was = post.saved;
      patch(post.id, (p) => ({ saved: !was, saves: Math.max(0, (p.saves || 0) + (was ? -1 : 1)) }));
      try {
        const { data } = await api.post(`/posts/${post.id}/save`);
        patch(post.id, () => ({ saved: data.saved, saves: data.saves }));
        qc.invalidateQueries({ queryKey: ["saved-posts"] });
        if (data.saved) notice("Saved");
      } catch (e) {
        patch(post.id, (p) => ({ saved: was, saves: Math.max(0, (p.saves || 0) + (was ? 1 : -1)) }));
        notice(errMsg(e));
      }
    },
    [patch, qc]
  );

  const follow = useCallback(
    async (post) => {
      const uid = post.author?.id || post.user_id;
      setPosts((list) => (list || []).map((p) => ((p.author?.id || p.user_id) === uid ? { ...p, followed: true } : p)));
      try {
        const { data } = await api.post("/swipe", { target_id: uid, action: "like" });
        qc.invalidateQueries({ queryKey: ["likes-sent"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        if (data.matched) {
          setMatch(data.match);
          qc.invalidateQueries({ queryKey: ["matches"] });
        }
      } catch (e) {
        setPosts((list) => (list || []).map((p) => ((p.author?.id || p.user_id) === uid ? { ...p, followed: false } : p)));
        notice(errMsg(e));
      }
    },
    [setPosts, qc]
  );

  const notInterested = useCallback(
    async (post) => {
      drop(post.id);
      try {
        await api.post(`/posts/${post.id}/hide`);
        notice("You'll see fewer posts like this");
      } catch (e) {
        notice(errMsg(e));
      }
    },
    [drop]
  );

  const report = useCallback(
    async (reason, details) => {
      if (!reportFor) return false;
      try {
        await api.post(`/posts/${reportFor.id}/report`, { reason, details });
        drop(reportFor.id);
        return true;
      } catch (e) {
        notice(errMsg(e));
        return false;
      }
    },
    [reportFor, drop]
  );

  const remove = useCallback(
    async (post) => {
      try {
        await api.delete(`/posts/${post.id}`);
        drop(post.id);
        qc.invalidateQueries({ queryKey: ["my-posts"] });
        qc.invalidateQueries({ queryKey: ["saved-posts"] });
        notice("Post deleted");
        return true;
      } catch (e) {
        notice(errMsg(e));
        return false;
      }
    },
    [drop, qc]
  );

  const openAuthor = useCallback(async (post) => {
    const uid = post.author?.id || post.user_id;
    if (!uid) return;
    try {
      const { data } = await api.get(`/users/${uid}`);
      setAuthor(data);
    } catch (e) {
      notice(errMsg(e, "Couldn't open that profile"));
    }
  }, []);

  const setCount = useCallback((field) => (id, n) => patch(id, () => ({ [field]: n })), [patch]);

  return {
    like, save, follow, notInterested, report, remove, openAuthor, patch, drop,
    commentsFor, setCommentsFor, shareFor, setShareFor, moreFor, setMoreFor, reportFor, setReportFor, author, setAuthor, match, setMatch,
    setComments: setCount("comments"), setShares: setCount("shares"),
  };
};
