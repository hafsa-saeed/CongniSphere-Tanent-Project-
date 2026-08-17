import toast from 'react-hot-toast';

const baseStyle = {
  background: '#18181b', // zinc-900
  color: '#f4f4f5', // zinc-100
  border: '1px solid #3f3f46', // zinc-700
  fontSize: '13px',
};

export const notify = {
  success: (message) => toast.success(message, { style: baseStyle, iconTheme: { primary: '#22c55e', secondary: '#18181b' } }),
  error: (message) => toast.error(message, { style: baseStyle, iconTheme: { primary: '#ef4444', secondary: '#18181b' } }),
  info: (message) => toast(message, { style: baseStyle, icon: 'ℹ️' }),
  promise: (promise, messages) => toast.promise(promise, messages, { style: baseStyle }),
};
