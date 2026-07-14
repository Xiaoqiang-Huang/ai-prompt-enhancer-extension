export const Switch = ({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) => (
  <button
    type="button"
    className="switch"
    data-on={checked}
    onClick={() => {
      onChange(!checked)
    }}
  >
    <span className="switch-thumb" />
  </button>
)
