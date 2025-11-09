import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastContainer, type Toast } from './Toast';

describe('ToastContainer', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('should render success toast', () => {
    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Success message' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('should render error toast', () => {
    const toasts: Toast[] = [
      { id: '2', type: 'error', message: 'Error message' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('should render warning toast', () => {
    const toasts: Toast[] = [
      { id: '3', type: 'warning', message: 'Warning message' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should render info toast', () => {
    const toasts: Toast[] = [
      { id: '4', type: 'info', message: 'Info message' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('should call onClose when clicking toast', () => {
    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Test' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    const toast = screen.getByText('Test').closest('.toast');
    expect(toast).toBeInTheDocument();

    if (toast) {
      fireEvent.click(toast);
      expect(mockOnClose).toHaveBeenCalledWith('1');
    }
  });

  it('should call onClose when clicking close button', () => {
    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Test' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledWith('1');
  });

  it('should auto-dismiss after duration', async () => {
    jest.useFakeTimers();

    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Test', duration: 1000 }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Test')).toBeInTheDocument();

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('1');
    });

    jest.useRealTimers();
  });

  it('should render multiple toasts', () => {
    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Message 1' },
      { id: '2', type: 'error', message: 'Message 2' },
      { id: '3', type: 'info', message: 'Message 3' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
    expect(screen.getByText('Message 3')).toBeInTheDocument();
  });

  it('should use default duration when not specified', async () => {
    jest.useFakeTimers();

    const toasts: Toast[] = [
      { id: '1', type: 'success', message: 'Test' }
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    // Default duration is 3000ms
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('1');
    });

    jest.useRealTimers();
  });
});
