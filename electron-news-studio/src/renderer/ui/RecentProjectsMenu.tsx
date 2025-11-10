import React from 'react';

export interface RecentProject {
  path: string;
  name: string;
  timestamp: number;
}

interface RecentProjectsMenuProps {
  projects: RecentProject[];
  onLoadProject: (path: string) => void;
  onClearHistory: () => void;
}

export function RecentProjectsMenu({ projects, onLoadProject, onClearHistory }: RecentProjectsMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        minWidth: '300px',
        maxWidth: '400px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        padding: '8px 0'
      }}
    >
      <div style={{
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border)'
      }}>
        Recent Projects
      </div>

      {projects.length === 0 ? (
        <div style={{
          padding: '16px 12px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          opacity: 0.7
        }}>
          No recent projects
        </div>
      ) : (
        <>
          {projects.map((project, idx) => (
            <div
              key={project.path}
              onClick={() => onLoadProject(project.path)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                borderBottom: idx < projects.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                📄 {project.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {project.path}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '2px' }}>
                {new Date(project.timestamp).toLocaleString()}
              </div>
            </div>
          ))}

          <div
            onClick={onClearHistory}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#ef4444',
              fontWeight: '500',
              marginTop: '4px',
              borderTop: '1px solid var(--border)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            🗑️ Clear History
          </div>
        </>
      )}
    </div>
  );
}
