import React from "react";
import type { VideoClip, TransitionType } from "../../shared/types";

interface ClipEditorProps {
  clip: VideoClip;
  onUpdate: (updates: Partial<VideoClip>) => void;
  onRemove: () => void;
}

export const ClipEditor = React.memo(({ clip, onUpdate, onRemove }: ClipEditorProps) => {
  const transitionTypes: TransitionType[] = [
    'none', 'fade', 'fadeblack', 'wipeleft', 'wiperight', 'wipeup', 'wipedown',
    'slideleft', 'slideright', 'slideup', 'slidedown', 'circlecrop', 'circleopen', 'dissolve'
  ];

  return (
    <div className="clip-editor">
      <div className="input-group">
        <label>Duration (seconds)</label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={clip.duration || 5}
          onChange={(e) => onUpdate({ duration: parseFloat(e.target.value) })}
        />
      </div>

      <div className="input-group">
        <label>Transition Type</label>
        <select
          value={clip.transition?.type || 'fade'}
          onChange={(e) => onUpdate({
            transition: {
              ...clip.transition,
              type: e.target.value as TransitionType,
              duration: clip.transition?.duration || 1
            }
          })}
        >
          {transitionTypes.map(type => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>Transition Duration (seconds)</label>
        <input
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={clip.transition?.duration || 1}
          onChange={(e) => onUpdate({
            transition: {
              ...clip.transition,
              type: clip.transition?.type || 'fade',
              duration: parseFloat(e.target.value)
            }
          })}
        />
      </div>

      <button
        className="btn btn-danger"
        onClick={onRemove}
        style={{ marginTop: '12px', width: '100%' }}
      >
        🗑️ Remove Clip
      </button>
    </div>
  );
});

ClipEditor.displayName = 'ClipEditor';
