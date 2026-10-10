import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-[7px] border shadow-sm flex items-start gap-3 text-xs font-medium ${
              isSuccess 
                ? 'bg-[#EFF4F0] border-[#C8D7CB] text-[#5F8065]'
                : isError
                ? 'bg-[#F9ECEB] border-[#E8C8C5] text-[#9A5C55]'
                : 'bg-[#FCFAF6] border-[#D8D1C5] text-[#2B2926]'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-[#5F8065] shrink-0 mt-0.5" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-[#9A5C55] shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-[#8A6A4A] shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
