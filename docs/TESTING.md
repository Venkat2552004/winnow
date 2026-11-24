# Manual test checklist

Run after a build (`npm run build`) and a reload of the extension and any open tabs.

## Install & settings

- [ ] Extension loads unpacked from `.output/chrome-mv3` without errors.
- [ ] Toolbar icon shows the Winnow mark.
- [ ] Popup opens and shows version, AI mode, fallback, and Gmail status.
- [ ] Settings opens in a full tab.
- [ ] First run shows the **Welcome to Winnow** card until consent is accepted.
- [ ] Accepting consent hides the card and persists after reopening.
- [ ] **Test connection** reports the background worker version and mode.

## AI layer (mock mode)

- [ ] Mock mode is on by default.
- [ ] **Clear cached scores** reports success and re-scores an open LinkedIn tab.
- [ ] With no Winnow base URL/key, classification still works from heuristics.
- [ ] **Popup → Developer tools → Test AI** returns a provider, model, email category/priority, and post score.
- [ ] With a live key, obvious bait scores low and a technical/insightful post scores high — not everything at 50.

## LinkedIn de-slop

- [ ] Open `linkedin.com/feed/`; posts are detected (popup → Developer tools → Diagnose shows `posts found > 0`).
- [ ] Job postings and referrals stay visible.
- [ ] Technical/project breakdowns stay visible.
- [ ] Actionable advice, self-improvement, and resource posts stay visible.
- [ ] Industry insight, case studies, personal lessons, and substantive discussion stay visible.
- [ ] Ads and promotional posts blur.
- [ ] Achievements without a lesson blur.
- [ ] Generic stories and generic motivation blur.
- [ ] Engagement bait blurs.
- [ ] Memes, funny videos, and off-topic politics/sports/entertainment blur.
- [ ] Pure hashtag / one-liner posts blur.
- [ ] A normal post with several hashtags but real commentary does **not** blur just because of hashtags.
- [ ] Clicking a blurred post reveals it; the score badge remains.
- [ ] Threshold slider changes how many posts blur.
- [ ] Settings → LinkedIn shows Balanced, Focus, and Chill presets.
- [ ] Picking a preset updates the blur set on an open LinkedIn tab.
- [ ] A type on **Always keep** stays visible even with a low score.
- [ ] A type on **Always blur** is blurred even with a high score.
- [ ] Moving a type between the two lists removes it from the other list and marks the preset Custom.
- [ ] Threshold changes only affect post types in neither list.
- [ ] Popup → Feed shows the preset name, blur/keep counts, and the Edit shortcut.
- [ ] **Pause on LinkedIn** removes all blurs immediately.
- [ ] Disabling the feature removes all blurs.
- [ ] Today's stats increment as you scroll.
- [ ] **Test blur** blurs the first post.
- [ ] **Test AI** returns a real score without an error.
- [ ] **DOM probe** returns JSON with `listItems` and `activityLinks`.
- [ ] Debug overlay pill appears when enabled.

## Gmail auth

- [ ] **Connect Gmail** opens Google's consent screen.
- [ ] Unverified-app warning can be bypassed via **Advanced → Go to Winnow**.
- [ ] After approval, settings shows **Connected as you@gmail.com**.
- [ ] **Load recent mail** lists 10 subjects and senders.
- [ ] **Disconnect** clears the connection and the recent list.
- [ ] Reconnecting works without a full reload.

## Gmail classify & label

- [ ] **Preview classification** returns rows sorted by priority.
- [ ] Bank statements, invoices, security alerts, travel, and legal mail get the right category.
- [ ] Security alerts score ≥ 90 and get `Priority`.
- [ ] Offers score low and do not get `Priority`.
- [ ] **Apply labels** creates the selected category labels in Gmail and applies them.
- [ ] Selecting a preset updates the enabled labels and cleanup defaults.
- [ ] Disabling a category stops Winnow from creating or applying that label.
- [ ] Running **Apply labels** again reports `labeled 0 · skipped N`.
- [ ] Popup priority inbox shows the top items and links into Gmail.
- [ ] Popup → Priority → **Refresh** re-scans mail and updates the list, including from the empty state.
- [ ] **Refresh** shows `Refreshing…` and is disabled while the scan runs.
- [ ] Applying labels in **Organize** updates the Priority tab without reopening the popup.
- [ ] Changing the priority threshold or enabled categories refreshes the Priority tab.
- [ ] If the background worker cannot answer, the Priority tab shows an error toast instead of "No priority mail yet".
- [ ] Popup tabs render: Priority, Organize, Feed.
- [ ] Popup → Organize → **Scan inbox** groups mail by label with counts and sample subjects.
- [ ] The group **Open** link opens Gmail filtered by that label.
- [ ] Closing and reopening the popup keeps the last scan (snapshot under 30 minutes).
- [ ] Popup → Organize → **Apply labels** reports `labeled N · skipped M · total T`.
- [ ] **Reset label memory** clears Winnow's record without touching Gmail labels.

## Unsubscribe & cleanup

- [ ] **Scan senders** lists senders with unsubscribe headers and message counts.
- [ ] Method badges show `one-click`, `link`, or `mailto`.
- [ ] Unchecking a sender excludes it from the run.
- [ ] **Unsubscribe selected** reports posted / opened / archived counts.
- [ ] One-click senders do not open a tab; link/mailto senders open a background tab.
- [ ] **Archive after unsubscribe** removes the sender's scanned mail from the inbox.
- [ ] **Preview cleanup** lists only aged labels selected as cleanup-eligible.
- [ ] Starred and important mail never appears in cleanup.
- [ ] **Archive** removes `INBOX` only; mail remains in All Mail.
- [ ] **Trash** asks for confirmation and moves mail to Trash.

## Visual system

- [ ] Popup header shows the aurora backdrop and the brand signal mark.
- [ ] Priority rows show a category dot, a short category label, and a score ring.
- [ ] Settings sections each show a signal mark; Gmail, unsubscribe, and LinkedIn cards have a seeded glow.
- [ ] Sender rows show seeded gradient avatars with initials.
- [ ] Cleanup rows show seeded avatars and score rings.
- [ ] LinkedIn blur overlay shows the score ring, signal mark, reason, and **Reveal post**.
- [ ] A post hidden by an always-blur override says **Hidden by category**, not **Low value**.
- [ ] An always-blurred post with a high score shows that high score on the ring and card.
- [ ] Changing a type to Always keep unblurs its posts; changing it to Always blur re-renders the card reason.
- [ ] Revealing a post leaves a `Winnow <score>` badge.
- [ ] With **Reduce motion** enabled in the OS, the aurora drift and transitions stop.
- [ ] The same sender/post keeps the same colours after a reload.

## Error handling

- [ ] Invalid custom API key → clear credentials error, then heuristic fallback.
- [ ] Invalid Sarvam key → fallback is skipped, no crash.
- [ ] Gmail 429 → automatic retry, then a readable rate-limit message.
- [ ] Expired Gmail token → clear "reconnect" message.
- [ ] Offline → readable unreachable message, no blank screens.

## Cache

- [ ] Cache survives a background worker restart.
- [ ] Expired entries are pruned on worker start.
- [ ] Cache is capped (oldest-expiring entries dropped first).
