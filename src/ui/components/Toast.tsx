export const Toast = ({ message }: { message: string }) =>
  message ? (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        background: '#0f172a',
        color: '#fff',
        padding: '12px 14px',
        borderRadius: 14,
        boxShadow: '0 16px 34px rgba(15,23,42,0.22)',
        zIndex: 9999,
      }}
    >
      {message}
    </div>
  ) : null
