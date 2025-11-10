# 🚧 DYNAMIC TRACKS MIGRATION - TODO

## ⚠️ Current Status: INCOMPLETE (30% done)

The codebase is currently in **broken state** - migration to dynamic tracks is 30% complete.

---

## ✅ Completed (3 commits)

### Commit 1: Types Update
- ✅ `types.ts`: Added `AudioTrack[]`, `LogoTrack[]`, `TickerTrack[]`
- ✅ Updated `Project` interface with new structure
- ✅ Updated `defaultProj` to use arrays

### Commit 2: Helper Functions
- ✅ Added 9 helper functions in `App.tsx`:
  - `addAudioTrack()`, `addLogoTrack()`, `addTickerTrack()`
  - `removeAudioTrack()`, `removeLogoTrack()`, `removeTickerTrack()`
  - `updateAudioTrack()`, `updateLogoTrack()`, `updateTickerTrack()`

### Commit 3: Media Libraries Updated
- ✅ Image Library: Click → `addLogoTrack(img)`
- ✅ Audio Library: Click → `addAudioTrack(audio, type)`
- ✅ Font Library: Click → prompt + `addTickerTrack(text, font)`

---

## ❌ TODO: Remaining Work (Est. 4-6 hours)

### 1. Remove Old Sidebar Sections (30 min)
**File**: `src/renderer/ui/App.tsx`

Need to find and remove these old sections:
- [ ] Logo section (uses `t.logo` - now should be `t.logos[]`)
- [ ] Audio section (uses `t.audio.bgm`, `t.audio.voice` - now `t.audios[]`)
- [ ] Ticker section (uses `t.ticker` - now `t.tickers[]`)

**Search patterns:**
```bash
grep -n "Logo Section" src/renderer/ui/App.tsx
grep -n "Audio Section" src/renderer/ui/App.tsx
grep -n "Ticker Section" src/renderer/ui/App.tsx
```

### 2. Add New Track Management UI (1 hour)
**File**: `src/renderer/ui/App.tsx`

Add new sections in Media tab:
- [ ] **Audio Tracks List**: Show all `t.audios[]` with edit/remove buttons
- [ ] **Logo Tracks List**: Show all `t.logos[]` with edit/remove buttons
- [ ] **Ticker Tracks List**: Show all `t.tickers[]` with edit/remove buttons

Each track should have:
- Name display
- Edit button (opens modal/inline edit)
- Remove button (× red button)

### 3. Rebuild Timeline UI (1-2 hours)
**File**: `src/renderer/ui/App.tsx` (lines 2477-2698)

Current timeline uses:
```typescript
t.logo?.src          // OLD
t.ticker?.text       // OLD
t.audio?.bgm?.src    // OLD
```

Need to change to:
```typescript
t.logos.map(logo => ...)     // NEW - loop through array
t.tickers.map(ticker => ...) // NEW - loop through array
t.audios.map(audio => ...)   // NEW - loop through array
```

**UI Structure:**
```
Timeline:
  - Ticker Tracks (loop t.tickers[])
  - Frame Track (single - keep as is)
  - Logo Tracks (loop t.logos[])
  - Audio Tracks (loop t.audios[])
  - Video Track (single - keep as is with t.video[] clips)
```

Each dynamic track should have:
- Track label with name
- Remove button (×)
- Track content display

### 4. Add CSS for Track Remove Button (15 min)
**File**: `src/renderer/index.html`

Add new CSS class:
```css
.btn-track-remove {
  width: 18px;
  height: 18px;
  padding: 0;
  background: rgba(220, 38, 38, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-track-remove:hover {
  background: rgba(185, 28, 28, 1);
  transform: scale(1.15);
}
```

### 5. Fix Exporter (30-45 min)
**File**: `src/main/render/exporter.ts`

Exporter currently expects:
```typescript
project.tracks.logo          // OLD
project.tracks.ticker        // OLD
project.tracks.audio.bgm     // OLD
project.tracks.audio.voice   // OLD
```

Need to update to loop through arrays:
```typescript
project.tracks.logos[]       // NEW
project.tracks.tickers[]     // NEW
project.tracks.audios[]      // NEW
```

**FFmpeg changes needed:**
- Logo overlay: Loop through `logos[]`, apply multiple overlays
- Ticker: Loop through `tickers[]`, create multiple drawtext filters
- Audio: Loop through `audios[]`, mix all audio tracks with ducking

### 6. Optional: Drag & Drop Track Reorder (1-2 hours)
**File**: `src/renderer/ui/App.tsx`

Add drag & drop to reorder tracks:
- [ ] Add `draggable` attribute to track elements
- [ ] Add `onDragStart`, `onDragOver`, `onDrop` handlers
- [ ] Update track order in state
- [ ] Visual feedback during drag

**Not critical** - can be added later.

### 7. Testing & Bug Fixes (1 hour)
- [ ] Test adding tracks from libraries
- [ ] Test removing tracks
- [ ] Test timeline display
- [ ] Test export with multiple tracks
- [ ] Fix any TypeScript errors
- [ ] Fix any runtime errors

---

## 📊 Estimated Time Breakdown

| Task | Est. Time | Priority |
|------|-----------|----------|
| Remove old sidebar sections | 30 min | HIGH |
| Add track management UI | 1 hour | HIGH |
| Rebuild timeline UI | 1-2 hours | HIGH |
| Add CSS | 15 min | MEDIUM |
| Fix exporter | 30-45 min | HIGH |
| Drag & drop | 1-2 hours | LOW |
| Testing | 1 hour | HIGH |
| **TOTAL** | **4-6 hours** | |

---

## 🔍 Search Commands to Find Old References

```bash
# Find all logo references (13 found)
grep -n "t\.logo" src/renderer/ui/App.tsx

# Find all ticker references (34 found)
grep -n "t\.ticker" src/renderer/ui/App.tsx

# Find all audio references (21 found)
grep -n "t\.audio" src/renderer/ui/App.tsx
```

---

## 🎯 Quick Start to Resume

1. **Remove old sections:**
   ```bash
   # Find Logo Section
   grep -n "Logo Section" src/renderer/ui/App.tsx
   # Delete lines from Logo Section
   ```

2. **Update timeline:**
   ```typescript
   // OLD (line ~2488-2497)
   {t.ticker?.text && t.ticker?.font ? (
     <div>...</div>
   ) : (...)}

   // NEW
   {t.tickers.map(ticker => (
     <div key={ticker.id}>
       {ticker.name} - {ticker.text}
       <button onClick={() => removeTickerTrack(ticker.id)}>×</button>
     </div>
   ))}
   ```

3. **Test:**
   ```bash
   npm run dev
   # Check console for errors
   # Test adding tracks from libraries
   ```

---

## 📝 Notes

- Current code is **broken** - don't use in production
- All commits are on branch: `claude/code-review-diagram-011CUykJmaXVCoW5DD9oThZr`
- Helper functions are ready to use
- Media libraries already integrated with new system
- Main work left is UI cleanup and timeline rebuild

---

**Last Updated**: 2025-11-10
**Branch**: claude/code-review-diagram-011CUykJmaXVCoW5DD9oThZr
**Commits**: 3 (314d140, 5b481f6, current)
