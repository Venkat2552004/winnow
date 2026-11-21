# Manual test checklist

Run after a build (`npm run build`) and a reload of the extension and any open tabs.

## Install & settings

- [ ] Extension loads unpacked from `.output/chrome-mv3` without errors.
- [ ] Toolbar icon shows the Jev mark.
- [ ] Popup opens and shows version, AI mode, fallback, and Gmail status.
- [ ] Settings opens in a full tab.
- [ ] First run shows the **Welcome to Jev** card until consent is accepted.
- [ ] Accepting consent hides the card and persists after reopening.
- [ ] **Test connection** reports the background worker version and mode.

## AI layer (mock mode)

- [ ] Mock mode is on by default.
- [ ] **Clear cached scores** reports success.
- [ ] With no Jev base URL/key, classification still works from heuristics.

## LinkedIn de-slop

- [ ] Open `linkedin.com/feed/`; posts are detected (popup → Developer tools → Diagnose shows `posts found > 0`).
- [ ] Obvious engagement bait / hype posts blur.
- [ ] Technical posts stay visible.
- [ ] Clicking a blurred post reveals it; the score badge remains.
- [ ] Threshold slider changes how many posts blur.
- [ ] **Pause on LinkedIn** removes all blurs immediately.
- [ ] Disabling the feature removes all blurs.
- [ ] Today's stats increment as you scroll.
- [ ] **Test blur** blurs the first post.
- [ ] **DOM probe** returns JSON with `listItems` and `activityLinks`.
- [ ] Debug overlay pill appears when enabled.

## Gmail auth

- [ ] **Connect Gmail** opens Google's consent screen.
- [ ] Unverified-app warning can be bypassed via **Advanced → Go to Jev**.
- [ ] After approval, settings shows **Connected as you@gmail.com**.
- [ ] **Load recent mail** lists 10 subjects and senders.
- [ ] **Disconnect** clears the connection and the recent list.
- [ ] Reconnecting works without a full reload.

## Gmail classify & label

- [ ] **Preview classification** returns rows sorted by priority.
- [ ] Bank statements, invoices, security alerts, travel, and legal mail get the right category.
- [ ] Security alerts score ≥ 90 and get `Jev/Priority`.
- [ ] Promotions score low and do not get `Jev/Priority`.
- [ ] **Apply labels** creates `Jev/*` labels in Gmail and applies them.
- [ ] Running **Apply labels** again reports `labeled 0 · skipped N`.
- [ ] Popup priority inbox shows the top items and links into Gmail.
- [ ] **Reset label memory** clears Jev's record without touching Gmail labels.

## Unsubscribe & cleanup

- [ ] **Scan senders** lists senders with unsubscribe headers and message counts.
- [ ] Method badges show `one-click`, `link`, or `mailto`.
- [ ] Unchecking a sender excludes it from the run.
- [ ] **Unsubscribe selected** reports posted / opened / archived counts.
- [ ] One-click senders do not open a tab; link/mailto senders open a background tab.
- [ ] **Archive after unsubscribe** removes the sender's scanned mail from the inbox.
- [ ] **Preview cleanup** lists only aged promotions/newsletters/notifications.
- [ ] Starred and important mail never appears in cleanup.
- [ ] **Archive** removes `INBOX` only; mail remains in All Mail.
- [ ] **Trash** asks for confirmation and moves mail to Trash.

## Error handling

- [ ] Invalid Jev key → clear credentials error, then heuristic fallback.
- [ ] Invalid Sarvam key → fallback is skipped, no crash.
- [ ] Gmail 429 → automatic retry, then a readable rate-limit message.
- [ ] Expired Gmail token → clear "reconnect" message.
- [ ] Offline → readable unreachable message, no blank screens.

## Cache

- [ ] Cache survives a background worker restart.
- [ ] Expired entries are pruned on worker start.
- [ ] Cache is capped (oldest-expiring entries dropped first).
